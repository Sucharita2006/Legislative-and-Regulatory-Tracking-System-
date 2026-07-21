import logging
from datetime import date, datetime, timedelta

from ..database import SessionLocal
from ..models import AnimalSubject, SyncLog
from .congress_api import CongressAPIClient
from .sync import process_bill, OUTCOME_INACTIVE
from .job_lock import try_acquire_lock, release_lock

logger = logging.getLogger(__name__)


def get_current_congress(d: date | None = None) -> int:
    """Return the number of the Congress in session on date *d* (default: today).

    A new Congress convenes on January 3 of every odd-numbered year.
    The 1st Congress began in 1789.
    """
    d = d or date.today()
    year = d.year
    # Before Jan 3 of an odd year the *previous* Congress is still seated.
    if year % 2 == 1 and d < date(year, 1, 3):
        year -= 1
    return ((year - 1789) // 2) + 1


def get_congress_start_date(congress: int) -> date:
    """Return the convening date (January 3) of the given Congress number."""
    start_year = 1789 + (congress - 1) * 2
    return date(start_year, 1, 3)

# The actual AI relevance-score gate lives in sync.py's process_bill()
# (shared by both backfill and daily sync), not here.


def process_daily_sync():
    """Daily incremental sync for the current congress.

    Fetches bills updated yesterday using fromDateTime/toDateTime filters,
    then runs each through the shared process_bill pipeline.
    """
    # This runs from two entry points — the manual /sync/daily endpoint and
    # the APScheduler cron job — so the lock lives here rather than at the
    # endpoint, to cover both callers with a single source of truth.
    if not try_acquire_lock("sync_daily"):
        logger.info("Daily sync already in progress — skipping this trigger.")
        return

    # Everything below is wrapped in this outer try/finally so the lock is
    # released even if something fails before the inner try/finally starts
    # (e.g. SessionLocal(), CongressAPIClient(), or the initial SyncLog
    # commit) — previously the lock could leak for its full TTL if setup
    # itself threw. The inner finally below also calls release_lock(); that
    # second call is a harmless no-op (deleting an already-deleted key).
    try:
        # Look back 3 days so bills whose Congress.gov updateDate lags behind
        # their actual action date (typically 1-2 days) are still captured.
        # Hash dedup in process_bill makes re-fetching already-stored bills cheap.
        today = date.today()
        lookback_start = today - timedelta(days=3)
        from_dt = f"{lookback_start.isoformat()}T00:00:00Z"
        to_dt = f"{today.isoformat()}T23:59:59Z"
        congress = get_current_congress(today)
        logger.info(f"Starting daily sync for Congress {congress}, range {from_dt} to {to_dt}.")

        db = SessionLocal()
        client = CongressAPIClient()

        sync_log = SyncLog(
            sync_type="daily_sync",
            status="running",
            congress=congress,
            start_time=datetime.now(),
            started_at=datetime.now(),
        )
        db.add(sync_log)
        db.commit()

        records_processed = 0
        active_bills_stored = 0
        inactive_bills_skipped = 0
        api_request_count = 0

        try:
            # Active animal subjects drive the matching rules (shared with backfill).
            active_subject_names = {
                s.subject_name
                for s in db.query(AnimalSubject).filter(AnimalSubject.active == True).all()
            }

            offset = 0
            limit = 200
            stop = False

            while not stop:
                response = client.fetch_bills(congress, offset=offset, limit=limit, from_date_time=from_dt, to_date_time=to_dt)
                api_request_count += 1

                bills = response.get("bills", [])
                if not bills:
                    break

                for list_bill in bills:
                    records_processed += 1
                    try:
                        result = process_bill(
                            db=db,
                            client=client,
                            list_bill=list_bill,
                            congress=congress,
                            active_subject_names=active_subject_names,
                        )
                    except Exception as e:
                        # Log and continue so a single problematic bill doesn't abort the
                        # entire daily sync. process_bill already logs and swallows
                        # some sub-errors, but network/read timeouts can bubble up here.
                        logger.exception(f"Failed processing bill entry: {e}")
                        # Continue to next bill without incrementing counts for this one.
                        continue
                    if result is None:
                        continue

                    api_request_count += result.api_requests
                    if result.outcome == OUTCOME_INACTIVE:
                        inactive_bills_skipped += 1
                    elif result.stored:
                        score = result.document.relevance_score or 0
                        active_bills_stored += 1
                        logger.info(f"Daily sync {result.outcome} bill {result.source_id} (score={score}).")

                if len(bills) < limit:
                    break
                offset += limit

            sync_log.status = "completed"
            sync_log.records_processed = records_processed
            sync_log.active_bills_stored = active_bills_stored
            sync_log.inactive_bills_skipped = inactive_bills_skipped
            sync_log.api_requests_made = api_request_count
            sync_log.error_message = (
                f"Daily sync completed. {records_processed} bills analyzed, "
                f"{active_bills_stored} stored/updated, {inactive_bills_skipped} inactive skipped."
            )
            sync_log.end_time = datetime.now()
            db.commit()
            logger.info(sync_log.error_message)
            try:
                from .cache import clear_cache
                clear_cache()
            except Exception as e:
                logger.warning(f"Failed to clear cache after daily sync: {e}")

        except Exception as e:
            db.rollback()
            sync_log.status = "failed"
            sync_log.records_processed = records_processed
            sync_log.active_bills_stored = active_bills_stored
            sync_log.inactive_bills_skipped = inactive_bills_skipped
            sync_log.api_requests_made = api_request_count
            sync_log.error_message = str(e)
            sync_log.end_time = datetime.now()
            db.commit()
            logger.exception(f"Daily sync failed: {e}")
            raise
        finally:
            client.close()
            db.close()
            release_lock("sync_daily")
    finally:
        release_lock("sync_daily")
