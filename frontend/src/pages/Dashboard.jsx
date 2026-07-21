import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchBills,
  fetchStats,
  fetchBillDetails,
  fetchBillActions,
  fetchLiveSearch,
  triggerAIProcess,
  getUser,
  updateUser,
  createUser,
  fetchSubjectsGrouped,
  fetchReviewBills,
  fetchUserPrompts,
  createUserPrompt,
  updateUserPrompt,
  deleteUserPrompt,
  sendTestDigest
} from '../services/api';
import { ThemeToggle } from '../components/ThemeToggle';
import './Dashboard.css';

const STATES = new Set([
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
  'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee',
  'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
]);

const mapAiSubjectToDb = (aiSubject, allDbSubjects) => {
  if (!aiSubject) return '';
  const s = aiSubject.toLowerCase();
  
  if (s.includes('wildlife')) {
    const match = allDbSubjects.find(x => x.toLowerCase().includes('wildlife conservation'));
    if (match) return match;
  }
  if (s.includes('endangered')) {
    const match = allDbSubjects.find(x => x.toLowerCase().includes('endangered'));
    if (match) return match;
  }
  if (s.includes('livestock') || s.includes('agriculture')) {
    const match = allDbSubjects.find(x => x.toLowerCase() === 'livestock');
    if (match) return match;
  }
  if (s.includes('cruelty') || s.includes('crime')) {
    const match = allDbSubjects.find(x => x.toLowerCase().includes('crimes against animals'));
    if (match) return match;
  }
  if (s.includes('companion') || s.includes('service') || s.includes('welfare') || s.includes('relationship')) {
    const match = allDbSubjects.find(x => x.toLowerCase().includes('animal protection and human-animal'));
    if (match) return match;
  }
  if (s.includes('aquatic') || s.includes('fishery') || s.includes('fisheries') || s.includes('fish')) {
    const match = allDbSubjects.find(x => x.toLowerCase().includes('marine and coastal resources'));
    if (match) return match;
  }
  if (s.includes('veterinary') || s.includes('health')) {
    const match = allDbSubjects.find(x => x.toLowerCase().includes('veterinary medicine'));
    if (match) return match;
  }
  if (s.includes('hunting') || s.includes('trapping')) {
    const match = allDbSubjects.find(x => x.toLowerCase().includes('hunting and fishing'));
    if (match) return match;
  }
  if (s.includes('habitat') || s.includes('land')) {
    const match = allDbSubjects.find(x => x.toLowerCase().includes('land use and conservation'));
    if (match) return match;
  }
  if (s.includes('food') || s.includes('labeling') || s.includes('safety')) {
    const match = allDbSubjects.find(x => x.toLowerCase().includes('food supply'));
    if (match) return match;
  }
  if (s.includes('trafficking') || s.includes('smuggling')) {
    const match = allDbSubjects.find(x => x.toLowerCase().includes('smuggling and trafficking'));
    if (match) return match;
  }

  const bestMatch = allDbSubjects.find(x => x.toLowerCase().includes(s) || s.includes(x.toLowerCase()));
  if (bestMatch) return bestMatch;
  
  return '';
};


const YESTERDAY_ISO = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
})();

// Congress.gov updateDate lags action dates by 1-2 days, so the sync
// captures bills whose actions happened up to 2 days ago. Show that
// same window in the "yesterday" tab so nothing falls through the gap.
const TWO_DAYS_AGO_ISO = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return d.toISOString().split('T')[0];
})();

export default function Dashboard({ onLogout, theme, toggleTheme, userEmail }) {
  // ── Preferences / Auth State
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [prefPrompt, setPrefPrompt] = useState('');
  const [prefFrequency, setPrefFrequency] = useState('daily');
  const [prefScope, setPrefScope] = useState('federal');
  const [prefMinScore, setPrefMinScore] = useState(70);
  const [prefExpandedTopics, setPrefExpandedTopics] = useState([]);
  const [prefStatus, setPrefStatus] = useState('');

  // ── Prompts Management State
  const [prompts, setPrompts] = useState([]);
  const [editingPrompt, setEditingPrompt] = useState(null); // null or the prompt object being edited
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [modalPromptText, setModalPromptText] = useState('');
  const [modalPromptFrequency, setModalPromptFrequency] = useState('daily');
  
  const [sendingTestId, setSendingTestId] = useState(null);
  const [testStatus, setTestStatus] = useState({}); // { [promptId]: { message: '', error: '' } }
  
  const [activeTab, setActiveTab] = useState('yesterday'); // yesterday, search, watchlist, prefs
  const [searchFiltersOpen, setSearchFiltersOpen] = useState(false);
  
  // ── Search & Filter State
  const [filterSubject, setFilterSubject] = useState('');
  const [filterChamber, setFilterChamber] = useState('');
  const [filterBillType, setFilterBillType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [subjectGroups, setSubjectGroups] = useState([]);

  const [manualOverrides, setManualOverrides] = useState({
    subject: false,
    chamber: false,
    billType: false,
    dateFrom: false,
    dateTo: false,
  });

  // ── AI Prompt Search State
  const [liveSearchInput, setLiveSearchInput] = useState('');
  const [liveSearchTopics, setLiveSearchTopics] = useState([]);
  const [showPromptBanner, setShowPromptBanner] = useState(false);

  // ── API state
  const [bills, setBills] = useState([]);
  const [isFallback, setIsFallback] = useState(false);
  const [totalBills, setTotalBills] = useState(0);
  const [yesterdayCount, setYesterdayCount] = useState(0);
  const [reviewedBills, setReviewedBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Modal State
  const [selectedBill, setSelectedBill] = useState(null);
  const [modalTab, setModalTab] = useState('overview'); // overview, ai, history, raw
  const [aiLoading, setAiLoading] = useState(false);
  const [modalDetailsLoading, setModalDetailsLoading] = useState(false);

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  useEffect(() => {
    fetchStats()
      .then(data => {
        setTotalBills(data.total_active_bills || 0);
      })
      .catch(err => console.error('Failed to load stats:', err));
      
    fetchSubjectsGrouped().then(data => setSubjectGroups(data || []));


    // Load prefs
    getUser(userEmail).then(data => {
      if (data) {
        setPrefScope(data.scope || 'federal');
        setPrefMinScore(50);
        setReviewedBills(data.review_bills || []);
        setPrompts(data.prompts || []);

        if (data.prompts && data.prompts.length > 0) {
          setPrefPrompt(data.prompts[0].prompt_text);
        }
      }
    }).catch(e => {
      console.error('Failed to load user profile:', e);
      if (e.message && (e.message.includes('404') || e.message.includes('401') || e.message.includes('403'))) {
        onLogout();
      }
    });
  }, [userEmail, onLogout]);

  useEffect(() => {
    if (activeTab === 'yesterday' || activeTab === 'search' || activeTab === 'watchlist') {
      loadBills(activeTab);
    }
  }, [activeTab]);

  const loadBillsRef = useRef(null);
  loadBillsRef.current = async (tab) => {
    setLoading(true);
    try {
      let params = { limit: 20, sortBy: 'last_action_date', order: 'desc' };

      if (tab === 'yesterday') {
        params.fromActionDate = TWO_DAYS_AGO_ISO;
        params.toActionDate = YESTERDAY_ISO;
      } else if (tab === 'watchlist') {
        if (!userEmail) { setBills([]); setLoading(false); return; }
        const data = await fetchReviewBills(userEmail);
        setBills(data.results || []);
        setIsFallback(false);
        setLoading(false);
        return;
      } else if (tab === 'search') {
        if (!filtersApplied) {
          params.limit = 40;
        } else {
          params.limit = 100;
          if (liveSearchInput.trim()) {
            params.userPrompt = liveSearchInput.trim();
            params.minScore = 30;
          }
          if (filterSubject) params.subject = filterSubject;
          if (filterBillType) params.billType = filterBillType;
          if (filterDateFrom) params.fromActionDate = filterDateFrom;
          if (filterDateTo) params.toActionDate = filterDateTo;
        }
      }


      const data = await fetchBills(params);
      let results = data.results || [];

      if (tab === 'search') {
        // AI filter inference and updates
        if (data.prompt_expansion) {
          setLiveSearchTopics(data.prompt_expansion.topics || []);
          setShowPromptBanner(true);

          if (data.prompt_expansion.inferred_filters) {
            const inf = data.prompt_expansion.inferred_filters;
            
            // 1. Subject
            if (!manualOverrides.subject && inf.subject) {
              const allDbSubjects = subjectGroups.flatMap(g => g.subjects.map(s => s.name));
              const mappedSubj = mapAiSubjectToDb(inf.subject, allDbSubjects);
              if (mappedSubj) {
                setFilterSubject(mappedSubj);
              }
            }
            
            // 2. Chamber
            if (!manualOverrides.chamber && inf.origin_chamber) {
              const normalized = inf.origin_chamber.toLowerCase();
              if (normalized.includes('senate')) {
                setFilterChamber('Senate');
              } else if (normalized.includes('house')) {
                setFilterChamber('House');
              }
            }
            
            // 3. Bill Type
            if (!manualOverrides.billType && inf.bill_type) {
              const typeUpper = inf.bill_type.toUpperCase();
              const validTypes = ['HR', 'S', 'HJRES', 'SJRES', 'HCONRES', 'SCONRES', 'HRES', 'SRES'];
              if (validTypes.includes(typeUpper)) {
                setFilterBillType(typeUpper);
              }
            }
            
            // 4. Date From
            if (!manualOverrides.dateFrom && inf.date_from) {
              if (/^\d{4}-\d{2}-\d{2}$/.test(inf.date_from)) {
                setFilterDateFrom(inf.date_from);
              }
            }
            
            // 5. Date To
            if (!manualOverrides.dateTo && inf.date_to) {
              if (/^\d{4}-\d{2}-\d{2}$/.test(inf.date_to)) {
                setFilterDateTo(inf.date_to);
              }
            }
          }
        } else {
          setShowPromptBanner(false);
          setLiveSearchTopics([]);
        }

        // Apply chamber filter (which is frontend-only)
        let activeChamber = filterChamber;
        if (!manualOverrides.chamber && data.prompt_expansion?.inferred_filters?.origin_chamber) {
          const normalized = data.prompt_expansion.inferred_filters.origin_chamber.toLowerCase();
          if (normalized.includes('senate')) activeChamber = 'Senate';
          else if (normalized.includes('house')) activeChamber = 'House';
        }
        
        if (activeChamber) {
          results = results.filter(b => (b.origin_chamber || 'House').toLowerCase() === activeChamber.toLowerCase());
        }
      }

      setBills(results);
      setIsFallback(false);

      if (tab === 'yesterday') setYesterdayCount(data.total || 0);
    } catch (err) {
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBills = useCallback((tab) => loadBillsRef.current(tab), []);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setSearchFiltersOpen(tab === 'search');
    setShowPromptBanner(false);
    if (tab !== 'search') {
      setFiltersApplied(false);
      setLiveSearchInput('');
      setLiveSearchTopics([]);
    }
  };

  const handleApplyFilters = () => {
    setFiltersApplied(true);
    setTimeout(() => loadBills('search'), 0);
  };

  const handleReset = () => {
    setLiveSearchInput('');
    setFilterSubject('');
    setFilterChamber('');
    setFilterBillType('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setManualOverrides({
      subject: false,
      chamber: false,
      billType: false,
      dateFrom: false,
      dateTo: false,
    });
    setFiltersApplied(false);
    setShowPromptBanner(false);
    setLiveSearchTopics([]);
    setTimeout(() => loadBills('search'), 0);
  };
  
  const handleSavePrefs = async () => {
    try {
      const res = await updateUser(userEmail, { scope: prefScope });
      setPrefStatus('Settings saved successfully!');
      setTimeout(() => setPrefStatus(''), 3000);
    } catch (e) {
      setPrefStatus('Failed to save settings.');
      setTimeout(() => setPrefStatus(''), 3000);
    }
  };

  const handleOpenAddPrompt = () => {
    setEditingPrompt(null);
    setModalPromptText('');
    setModalPromptFrequency('daily');
    setIsPromptModalOpen(true);
  };

  const handleOpenEditPrompt = (e, prompt) => {
    e.stopPropagation();
    setEditingPrompt(prompt);
    setModalPromptText(prompt.prompt_text);
    setModalPromptFrequency(prompt.frequency);
    setIsPromptModalOpen(true);
  };

  const handleSavePrompt = async (e) => {
    e.preventDefault();
    if (!modalPromptText.trim()) return;

    try {
      let newPrompts;
      if (editingPrompt) {
        const updated = await updateUserPrompt(userEmail, editingPrompt.id, {
          prompt_text: modalPromptText.trim(),
          frequency: modalPromptFrequency
        });
        newPrompts = prompts.map(p => p.id === editingPrompt.id ? updated : p);
      } else {
        const created = await createUserPrompt(userEmail, {
          prompt_text: modalPromptText.trim(),
          frequency: modalPromptFrequency
        });
        newPrompts = [...prompts, created];
      }
      setPrompts(newPrompts);
      if (newPrompts.length > 0) {
        setPrefPrompt(newPrompts[0].prompt_text);
      } else {
        setPrefPrompt('');
      }
      setIsPromptModalOpen(false);
      setEditingPrompt(null);
      setModalPromptText('');
    } catch (err) {
      alert('Failed to save tracking interest: ' + err.message);
    }
  };

  const handleDeletePrompt = async (e, promptId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this tracking interest?')) return;

    try {
      await deleteUserPrompt(userEmail, promptId);
      const newPrompts = prompts.filter(p => p.id !== promptId);
      setPrompts(newPrompts);
      if (newPrompts.length > 0) {
        setPrefPrompt(newPrompts[0].prompt_text);
      } else {
        setPrefPrompt('');
      }
    } catch (err) {
      alert('Failed to delete tracking interest: ' + err.message);
    }
  };

  const handleSendTestEmail = async (e, prompt) => {
    e.stopPropagation();
    if (!userEmail || sendingTestId) return;

    setTestStatus(prev => ({
      ...prev,
      [prompt.id]: null
    }));
    setSendingTestId(prompt.id);

    try {
      await sendTestDigest(userEmail, prompt.frequency);
      setTestStatus(prev => ({
        ...prev,
        [prompt.id]: { message: `Test email sent successfully to ${userEmail}.` }
      }));
    } catch (err) {
      setTestStatus(prev => ({
        ...prev,
        [prompt.id]: { error: `Failed to send test email: ${err.message}` }
      }));
    } finally {
      setSendingTestId(null);
    }
  };
  
  const handleBookmarkToggle = async (e, bill) => {
    e.stopPropagation();
    if (!userEmail) return;
    const isBookmarked = reviewedBills.includes(bill.source_id);
    const updated = isBookmarked
      ? reviewedBills.filter(id => id !== bill.source_id)
      : [...reviewedBills, bill.source_id];
    setReviewedBills(updated);
    try {
      await updateUser(userEmail, { review_bills: updated });
      if (activeTab === 'watchlist') loadBills('watchlist');
    } catch (e) {
      setReviewedBills(reviewedBills); // revert on failure
    }
  };

  const handleBillClick = async (bill) => {
    setSelectedBill(bill);
    setModalTab('overview');
    setModalDetailsLoading(true);
    try {
      const [details, actionsData] = await Promise.all([
        fetchBillDetails(bill.source_id),
        fetchBillActions(bill.source_id),
      ]);
      const actionHistory = (actionsData.actions || []).map(a => ({
        date: a.actionDate,
        text: a.text,
        source: a.actionCode || a.sourceSystem?.name || '',
      }));
      setSelectedBill(prev => ({ ...prev, ...details, action_history: actionHistory }));
    } catch (err) {}
    finally {
      setModalDetailsLoading(false);
    }
  };
  
  const runAiAnalysis = async () => {
    setAiLoading(true);
    try {
      await triggerAIProcess(selectedBill.source_id);
      const updated = await fetchBillDetails(selectedBill.source_id);
      setSelectedBill(prev => ({ ...prev, ...updated }));
    } catch (e) {
      alert('AI Analysis failed.');
    } finally {
      setAiLoading(false);
    }
  };

  const getProgressTracker = (bill) => {
    let currentStep = 1; 
    const isSenate = (bill.origin_chamber || 'House').toLowerCase() === 'senate';
    const hist = bill.action_history || [];
    const passedHouse = hist.some(a => (a.text||'').toLowerCase().includes('passed house') || (a.text||'').toLowerCase().includes('agreed to in house'));
    const passedSenate = hist.some(a => (a.text||'').toLowerCase().includes('passed senate') || (a.text||'').toLowerCase().includes('agreed to in senate'));
    const toPresident = hist.some(a => (a.text||'').toLowerCase().includes('presented to president'));
    const becameLaw = hist.some(a => (a.text||'').toLowerCase().includes('became public law') || (a.text||'').toLowerCase().includes('signed by president'));

    if (becameLaw) currentStep = 5;
    else if (toPresident) currentStep = 4;
    else if (passedHouse && passedSenate) currentStep = 3;
    else if (isSenate && passedSenate) currentStep = 2;
    else if (!isSenate && passedHouse) currentStep = 2;

    return {
      currentStep,
      labels: [
        'INTRODUCED',
        isSenate ? 'PASSED SENATE' : 'PASSED HOUSE',
        isSenate ? 'PASSED HOUSE' : 'PASSED SENATE',
        'TO PRESIDENT',
        'BECAME LAW'
      ]
    };
  };

  return (
    <div className="dashboard-container">
      <div className="app-container">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="app-header">
          <div className="brand">
            <div className="logo-icon"><i className="fa-solid fa-shield-cat"></i></div>
            <div className="brand-text">
              <h1>Animal Legislation Tracker</h1>
              <span className="badge-label">ALDF Ingestion Module</span>
            </div>
          </div>
          <div className="header-right" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            <div className="user-menu-container" style={{ position: 'relative' }}>
              <button 
                className="btn btn-user" 
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <i className="fa-solid fa-user"></i>
              </button>

              {userMenuOpen && (
                <>
                  <div className="user-menu-backdrop" onClick={() => setUserMenuOpen(false)}></div>
                  <div className="user-menu-dropdown">
                    <div className="user-menu-email">{userEmail}</div>
                    <button className="user-menu-item" onClick={onLogout}>
                      <i className="fa-solid fa-right-from-bracket"></i> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── Stats Strip ────────────────────────────────────────────────────── */}
        <section className="stats-strip">
          <div className="stat-card" style={{cursor: 'pointer'}} onClick={() => handleTabClick('yesterday')}>
            <div className="stat-icon" style={{color: '#f59e0b'}}><i className="fa-solid fa-bolt"></i></div>
            <div className="stat-content">
              <p className="stat-label">Bills Tracked Today</p>
              <h3 className="stat-value">{yesterdayCount}</h3>
              <p className="stat-subtext">New legislative actions</p>
            </div>
          </div>
          <div className="stat-card" style={{cursor: 'pointer'}} onClick={() => { handleTabClick('search'); setLiveSearchInput(''); setFilterSubject(''); setFilterChamber(''); setFilterBillType(''); setFilterDateFrom(''); setFilterDateTo(''); setManualOverrides({ subject: false, chamber: false, billType: false, dateFrom: false, dateTo: false }); setFiltersApplied(true); setTimeout(() => loadBills('search'), 0); }}>
            <div className="stat-icon" style={{color: 'var(--c-teal-bright)'}}><i className="fa-solid fa-folder-open"></i></div>
            <div className="stat-content">
              <p className="stat-label">Total Active Bills</p>
              <h3 className="stat-value">{totalBills}</h3>
              <p className="stat-subtext">Stored in database</p>
            </div>
          </div>

          <div className="stat-card" style={{cursor: 'pointer'}} onClick={() => handleTabClick('watchlist')}>
            <div className="stat-icon" style={{color: '#ef4444'}}><i className="fa-solid fa-bookmark"></i></div>
            <div className="stat-content">
              <p className="stat-label">Watchlist</p>
              <h3 className="stat-value">{reviewedBills.length}</h3>
              <p className="stat-subtext">Bills you're monitoring</p>
            </div>
          </div>
        </section>

        {/* ── Main Content ───────────────────────────────────────────────────── */}
        <main className="content-section">
          <div className="control-panel">
            <div className="tabs-container">
              <button className={`tab-btn ${activeTab === 'yesterday' ? 'active' : ''}`} onClick={() => handleTabClick('yesterday')}>
                <i className="fa-solid fa-calendar-day"></i> Yesterday
              </button>
              <button className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`} onClick={() => handleTabClick('search')}>
                <i className="fa-solid fa-magnifying-glass"></i> Search
              </button>
              <button className={`tab-btn ${activeTab === 'watchlist' ? 'active' : ''}`} onClick={() => handleTabClick('watchlist')}>
                <i className="fa-solid fa-bookmark"></i> Watchlist
              </button>
              <button className={`tab-btn ${activeTab === 'prefs' ? 'active' : ''}`} onClick={() => handleTabClick('prefs')}>
                <i className="fa-solid fa-sliders"></i> Preferences
              </button>
            </div>

            {/* Filters Dropdown */}
            {activeTab === 'search' && (
              <div className="filter-dropdown active">
                <div className="search-filter-grid">
                  <div className="form-group prompt-field" style={{ gridColumn: 'span 6' }}>
                    <label>YOUR PROMPT</label>
                    <textarea 
                      rows="3" 
                      value={liveSearchInput} 
                      onChange={e => setLiveSearchInput(e.target.value)} 
                      placeholder='Describe what you are looking for (e.g., "Senate wildlife trafficking bills introduced after January", "House bills about factory farming in California")'
                      className="prompt-textarea"
                    ></textarea>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Subject</label>
                    <div className="input-with-icon">
                      <i className="fa-solid fa-tag"></i>
                      <select 
                        value={filterSubject} 
                        onChange={e => {
                          setFilterSubject(e.target.value);
                          setManualOverrides(prev => ({ ...prev, subject: true }));
                        }}
                      >
                        <option value="">All Subjects</option>
                        {subjectGroups.map(group => (
                          <optgroup key={group.category} label={group.category}>
                            {group.subjects.map(s => (
                              <option key={s.name} value={s.name}>{s.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Origin Chamber</label>
                    <div className="input-with-icon">
                      <i className="fa-solid fa-building-columns"></i>
                      <select 
                        value={filterChamber} 
                        onChange={e => {
                          setFilterChamber(e.target.value);
                          setManualOverrides(prev => ({ ...prev, chamber: true }));
                        }}
                      >
                        <option value="">All Chambers</option>
                        <option value="House">House</option>
                        <option value="Senate">Senate</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Bill Type</label>
                    <div className="input-with-icon">
                      <i className="fa-solid fa-file-lines"></i>
                      <select 
                        value={filterBillType} 
                        onChange={e => {
                          setFilterBillType(e.target.value);
                          setManualOverrides(prev => ({ ...prev, billType: true }));
                        }}
                      >
                        <option value="">All Types</option>
                        <option value="HR">HR</option>
                        <option value="S">S</option>
                        <option value="HJRES">HJRES</option>
                        <option value="SJRES">SJRES</option>
                        <option value="HCONRES">HCONRES</option>
                        <option value="SCONRES">SCONRES</option>
                        <option value="HRES">HRES</option>
                        <option value="SRES">SRES</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 3' }}>
                    <label>From Date</label>
                    <div className="input-with-icon">
                      <i className="fa-solid fa-calendar-days" style={{pointerEvents: 'auto', cursor: 'pointer'}} onClick={e => e.target.nextElementSibling?.showPicker && e.target.nextElementSibling.showPicker()}></i>
                      <input 
                        type="date" 
                        value={filterDateFrom} 
                        onChange={e => {
                          setFilterDateFrom(e.target.value);
                          setManualOverrides(prev => ({ ...prev, dateFrom: true }));
                        }} 
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 3' }}>
                    <label>To Date</label>
                    <div className="input-with-icon">
                      <i className="fa-solid fa-calendar-days" style={{pointerEvents: 'auto', cursor: 'pointer'}} onClick={e => e.target.nextElementSibling?.showPicker && e.target.nextElementSibling.showPicker()}></i>
                      <input 
                        type="date" 
                        value={filterDateTo} 
                        onChange={e => {
                          setFilterDateTo(e.target.value);
                          setManualOverrides(prev => ({ ...prev, dateTo: true }));
                        }} 
                      />
                    </div>
                  </div>
                  <div className="form-group button-group" style={{gridColumn: 'span 6', justifyContent: 'flex-end', marginTop: '0.5rem', display: 'flex', gap: '0.75rem'}}>
                    <button className="btn btn-primary" onClick={handleApplyFilters} style={{padding: '0.6rem 1.5rem'}}><i className="fa-solid fa-magnifying-glass"></i> Search Bills</button>
                    <button className="btn btn-secondary" onClick={handleReset} style={{padding: '0.6rem 1.5rem'}}><i className="fa-solid fa-rotate-left"></i> Reset</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Prompt Banner */}
          {showPromptBanner && (
            <div className="prompt-expansion-banner visible">
              <div className="peb-left">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
                <span>Expanded prompt: <strong>"{liveSearchInput}"</strong></span>
              </div>
              <div className="peb-topics">
                {liveSearchTopics.map(t => <span key={t} className="peb-topic-pill">{t}</span>)}
              </div>
              <button className="peb-clear" onClick={() => setShowPromptBanner(false)}><i className="fa-solid fa-xmark"></i> Clear</button>
            </div>
          )}
          
          {/* Preferences Panel */}
          {activeTab === 'prefs' && (
            <div className="panel-section visible">
              <div className="prefs-header">
                <h2><i className="fa-solid fa-sliders"></i> Tracking Preferences</h2>
                <p className="prefs-subtitle">Configure the email notification scope and manage your saved animal interest tracking prompts.</p>
              </div>

              {/* General Settings: Scope */}
              <div className="prefs-form" style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>General Notification Settings</h3>
                <div className="prefs-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  <div className="prefs-field">
                    <label>Your Email</label>
                    <div className="input-with-icon">
                      <i className="fa-solid fa-envelope"></i>
                      <input type="email" value={userEmail || ''} readOnly disabled style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                    </div>
                  </div>
                  <div className="prefs-field">
                    <label>Notification Scope</label>
                    <div className="input-with-icon">
                      <i className="fa-solid fa-globe"></i>
                      <select value={prefScope} onChange={e => setPrefScope(e.target.value)}>
                        <option value="federal">Federal Only</option>
                        <option value="priority_states">Priority States</option>
                        <option value="all_states">All States</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="prefs-actions" style={{ marginTop: '1.5rem' }}>
                  <button className="btn btn-primary" onClick={handleSavePrefs}><i className="fa-solid fa-floppy-disk"></i> Save Settings</button>
                </div>
                {prefStatus && <div style={{ marginTop: '1rem', color: 'var(--c-teal)' }}>{prefStatus}</div>}
              </div>

              {/* Tracking Interests Prompts Grid */}
              <div style={{ marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>Saved Tracking Interests</h3>
                  <button className="btn btn-primary" onClick={handleOpenAddPrompt}>
                    <i className="fa-solid fa-plus"></i> Add Interest
                  </button>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Each tracking interest is evaluated by our AI engine with a fixed minimum relevance score of 50.
                </p>

                <div className="prompts-grid">
                  {prompts.map(prompt => (
                    <div key={prompt.id} className="prompt-card" onClick={(e) => handleOpenEditPrompt(e, prompt)}>
                      <div className="prompt-card-body">
                        <div className="prompt-card-header">
                          <span className={`prompt-badge ${prompt.frequency}`}>
                            {prompt.frequency === 'daily' ? 'Daily Digest' : 'Weekly Digest'}
                          </span>
                        </div>
                        <p className="prompt-card-text">{prompt.prompt_text}</p>
                        
                        {testStatus[prompt.id]?.message && (
                          <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--c-teal-bright)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                            <i className="fa-solid fa-circle-check"></i> {testStatus[prompt.id].message}
                          </p>
                        )}
                        {testStatus[prompt.id]?.error && (
                          <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--c-error)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                            <i className="fa-solid fa-circle-xmark"></i> {testStatus[prompt.id].error}
                          </p>
                        )}
                      </div>
                      <div className="prompt-card-actions">
                        <button 
                          className="btn-test-email" 
                          disabled={sendingTestId !== null}
                          onClick={(e) => handleSendTestEmail(e, prompt)}
                          style={{ opacity: sendingTestId && sendingTestId !== prompt.id ? 0.4 : 1 }}
                        >
                          {sendingTestId === prompt.id ? "Mailing…" : "Test Email"}
                        </button>
                        <button 
                          className="btn-icon-edit" 
                          title="Edit Interest" 
                          disabled={sendingTestId !== null}
                          onClick={(e) => handleOpenEditPrompt(e, prompt)}
                          style={{ opacity: sendingTestId ? 0.4 : 1 }}
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button 
                          className="btn-icon-danger" 
                          title="Delete Interest" 
                          disabled={sendingTestId !== null}
                          onClick={(e) => handleDeletePrompt(e, prompt.id)}
                          style={{ opacity: sendingTestId ? 0.4 : 1 }}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="prompt-card prompt-card-add" onClick={handleOpenAddPrompt}>
                    <div className="add-icon-wrapper">
                      <i className="fa-solid fa-plus"></i>
                    </div>
                    <span>Add New Tracking Interest</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bills Feed */}
          {loading ? (
            <div style={{padding:'3rem', textAlign:'center', color:'var(--text-secondary)'}}><i className="fa-solid fa-spinner fa-spin"></i> Loading...</div>
          ) : activeTab !== 'prefs' && (
            <div>
              {activeTab === 'search' && !filtersApplied && bills.length > 0 && (
                <div className="search-initial-recent-header" style={{ marginBottom: '1.5rem', padding: '0 0.5rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 0.25rem 0' }}>
                    <i className="fa-solid fa-clock" style={{ color: 'var(--c-teal-bright)' }}></i> Recent Legislative Actions
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                    Showing recent activity. Use the filters above to search for specific bills.
                  </p>
                </div>
              )}
              {bills.length === 0 && (
                <div className="fallback-banner" style={{display:'flex'}}>
                  <i className="fa-solid fa-circle-info"></i>
                  <div className="fallback-text">
                    {activeTab === 'watchlist' && !userEmail
                      ? <><strong>Sign in to use the Watchlist.</strong><span>Log in to bookmark bills for your Watchlist.</span></>
                      : activeTab === 'watchlist'
                        ? <><strong>No bills in your watchlist.</strong><span>Click the <i className="fa-regular fa-bookmark"></i> icon on any bill to add it to your Watchlist.</span></>
                        : <><strong>No actions found.</strong><span>No legislative actions match your criteria.</span></>
                    }
                  </div>
                </div>
              )}
              
              <div className="bills-feed">
                {bills.map((bill, index) => {
                  const chamber = bill.origin_chamber?.toLowerCase() || 'house';
                  const stageClass = bill.current_stage?.toLowerCase().includes('signed') || bill.current_stage?.toLowerCase().includes('passed') ? 'passed' : bill.current_stage?.toLowerCase().includes('fail') ? 'failed' : '';
                  const allSubjects = bill.subjects?.flatMap(s => s.split(',').map(str => str.trim())).filter(Boolean) || [];
                  const isPromptSearchActive = activeTab === 'search' && liveSearchInput.trim() !== '';
                  const displayScore = isPromptSearchActive ? (bill.prompt_score ?? bill.relevance_score) : bill.relevance_score;
                  const scoreLabel = 'Animal Relevance Score';

                  return (
                    <div key={bill.id || bill.source_id}>
                      <div className={`bill-card ${chamber}`} onClick={() => handleBillClick(bill)}>
                        <div className="bill-card-top">
                          <div className="bill-card-meta">
                            <div className="card-header">
                              <span className={`chamber-badge ${chamber}`}>{bill.origin_chamber}</span>
                              <span className="bill-id">{bill.source_id}</span>
                              <span className="bill-policy-area">{bill.policy_area}</span>
                            </div>
                            <h3 className="bill-title" title={bill.title}>{bill.title}</h3>
                            <div className="bill-sponsor">
                              <i className="fa-solid fa-user-tie"></i>
                              <span>{bill.sponsor_name ? `Sponsor: ${bill.sponsor_name}` : 'Sponsor: N/A'}</span>
                            </div>
                          </div>
                          <div className="bill-card-right">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                              {userEmail && (
                                <button
                                  onClick={(e) => handleBookmarkToggle(e, bill)}
                                  title={reviewedBills.includes(bill.source_id) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0.4rem', color: reviewedBills.includes(bill.source_id) ? '#ef4444' : 'var(--text-tertiary)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                >
                                  <i className={reviewedBills.includes(bill.source_id) ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'}></i>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                                    {reviewedBills.includes(bill.source_id) ? 'Watching' : 'Watch'}
                                  </span>
                                </button>
                              )}
                              {(displayScore !== null && displayScore !== undefined) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', border: `1px solid ${displayScore >= 70 ? 'var(--c-teal)' : displayScore >= 40 ? '#f59e0b' : '#ef4444'}` }}>
                                  <i className="fa-solid fa-brain" style={{color: 'var(--c-teal)', fontSize: '0.7rem'}}></i>
                                  <span style={{fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 'bold', color: displayScore >= 70 ? 'var(--c-teal-bright)' : displayScore >= 40 ? '#f59e0b' : '#ef4444'}}>
                                    {scoreLabel}: {displayScore}
                                  </span>
                                </div>
                              )}
                            </div>
                            <span className={`card-stage ${stageClass}`}>{bill.current_stage}</span>
                            <span className="card-more">Details <i className="fa-solid fa-arrow-right"></i></span>
                          </div>
                        </div>
                        <div className="bill-card-bottom">
                          <div className="card-action-block">
                            <div className="action-header">
                              <span className="action-title">LATEST ACTION</span>
                              <span className="action-time">{formatDisplayDate(bill.last_action_date)}</span>
                            </div>
                            <p className="action-text">{bill.last_action_text}</p>
                          </div>
                          <div className="pill-container">
                            {allSubjects.slice(0, 3).map((s, i) => <span key={i} className="subject-pill">{s}</span>)}
                            {allSubjects.length > 3 && <span className="subject-pill">+{allSubjects.length - 3} more</span>}
                          </div>
                        </div>
                      </div>
                      {index < bills.length - 1 && <div className="bill-divider"></div>}
                    </div>
                  );
                })}
              </div>
              
              {/* Exports */}
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Export Current View</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <a href={import.meta.env.PROD ? "/export/csv" : "/api/export/csv"} className="btn btn-secondary"><i className="fa-solid fa-file-csv"></i> CSV</a>
                    <a href={import.meta.env.PROD ? "/export/json" : "/api/export/json"} className="btn btn-secondary"><i className="fa-solid fa-code"></i> JSON</a>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Detail Modal ──────────────────────────────────────────────────────── */}
      {selectedBill && (
        <div className="modal-overlay active" onClick={e => e.target.classList.contains('modal-overlay') && (setSelectedBill(null), setModalDetailsLoading(false))}>
          <div className="modal-container detail-modal-new">
            <button className="modal-close-btn" onClick={() => { setSelectedBill(null); setModalDetailsLoading(false); }}>
              <i className="fa-solid fa-xmark"></i>
            </button>

            {/* Title */}
            <div className="modal-header-new">
              <h2 className="modal-title-new">{selectedBill.title}</h2>
            </div>

            {/* Tabs */}
            <div className="modal-tabs" style={{ display: 'flex', gap: '1rem', padding: '0 2rem', borderBottom: '1px solid var(--border-color)' }}>
              {[['overview', 'Overview'], ['ai', 'AI Analysis'], ['history', 'Action History']].map(([key, label]) => (
                <button
                  key={key}
                  style={{ background: 'none', border: 'none', padding: '0.75rem 1rem', color: modalTab === key ? 'var(--c-teal)' : 'var(--text-secondary)', borderBottom: modalTab === key ? '2px solid var(--c-teal)' : '2px solid transparent', cursor: 'pointer', fontWeight: '600' }}
                  onClick={() => setModalTab(key)}
                >{label}</button>
              ))}
            </div>

            <div className="modal-body-new">

              {/* ── Overview Tab ── */}
              {modalTab === 'overview' && (
                <>
                  {/* Bill Information */}
                  <div className="modal-section-new">
                    <h4 className="section-title-new">Bill Information</h4>
                    <div className="metadata-grid-new">
                      <div className="meta-row-new">
                        <span className="meta-key-new">Congress</span>
                        <span className="meta-value-new">{selectedBill.congress}th Congress</span>
                      </div>
                      <div className="meta-row-new">
                        <span className="meta-key-new">Introduced Date</span>
                        <span className="meta-value-new">{formatDisplayDate(selectedBill.introduced_date)}</span>
                      </div>
                      <div className="meta-row-new">
                        <span className="meta-key-new">Sponsor</span>
                        <span className="meta-value-new">{selectedBill.sponsor_name || 'N/A'}</span>
                      </div>
                      <div className="meta-row-new">
                        <span className="meta-key-new">Policy Area</span>
                        <span className="meta-value-new">{selectedBill.policy_area || 'N/A'}</span>
                      </div>
                      <div className="meta-row-new">
                        <span className="meta-key-new">Current Stage</span>
                        <span className="meta-value-new">{selectedBill.current_stage || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Matched Subjects */}
                  {selectedBill.subjects?.length > 0 && (
                    <div className="modal-section-new">
                      <h4 className="section-title-new">Matched Subjects</h4>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {selectedBill.subjects.map(s => (
                          <li key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            <i className="fa-solid fa-circle-dot" style={{ color: 'var(--c-teal)', fontSize: '0.5rem' }}></i>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Latest Legislative Action */}
                  <div className="modal-section-new">
                    <h4 className="section-title-new">Latest Legislative Action</h4>
                    <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                      {formatDisplayDate(selectedBill.last_action_date)}
                    </div>
                    <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', margin: '0 0 1.25rem 0' }}>
                      {selectedBill.last_action_text}
                    </p>
                    {selectedBill.source_url && (
                      <a href={selectedBill.source_url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                        <i className="fa-solid fa-arrow-up-right-from-square"></i> Open in Congress.gov
                      </a>
                    )}
                  </div>
                </>
              )}

              {/* ── AI Analysis Tab ── */}
              {modalTab === 'ai' && (
                <div className="modal-section-new">
                  <h4 className="section-title-new">AI INTELLIGENCE REPORT</h4>
                  {aiLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center' }}><i className="fa-solid fa-spinner fa-spin"></i> Analyzing bill text...</div>
                  ) : modalDetailsLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center' }}><i className="fa-solid fa-spinner fa-spin"></i> Loading analysis...</div>
                  ) : !selectedBill.ai_generated_at ? (
                    <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                      <i className="fa-solid fa-brain" style={{ fontSize: '2rem', color: 'var(--c-teal)', marginBottom: '1rem', display: 'block' }}></i>
                      <p style={{ marginBottom: '1rem' }}>This bill hasn't been analyzed by our AI engine yet.</p>
                      <button className="btn btn-primary" onClick={runAiAnalysis}><i className="fa-solid fa-wand-magic-sparkles"></i> Run Full Analysis</button>
                    </div>
                  ) : (() => {
                    const isPromptSearchActive = activeTab === 'search' && liveSearchInput.trim() !== '';
                    const displayScore = isPromptSearchActive ? (selectedBill.prompt_score ?? selectedBill.relevance_score) : selectedBill.relevance_score;
                    const scoreLabel = 'Animal Relevance Score';
                    
                    const isHigh = displayScore >= 70;
                    const isMid = displayScore >= 40 && displayScore < 70;
                    const scoreClass = isHigh ? 'score-high' : isMid ? 'score-mid' : 'score-low';
                    const tierLabel = isHigh ? 'High Relevance' : isMid ? 'Moderate Relevance' : 'Low Relevance';
                    const tierColor = isHigh ? 'var(--c-teal-bright)' : isMid ? '#f59e0b' : '#ef4444';

                    return (
                      <div>
                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                          <div className={`ai-score-circle ${scoreClass}`} style={{ width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '700', background: 'var(--bg-secondary)' }}>
                            {displayScore}
                          </div>
                          <div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{scoreLabel}</div>
                            <div style={{ fontWeight: 'bold', color: tierColor }}>{tierLabel}</div>
                          </div>
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Extracted Topics</h4>
                          <div className="pill-container">
                            {(selectedBill.relevance_topics || []).map(t => <span key={t} className="subject-pill">{t}</span>)}
                          </div>
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Rationale</h4>
                          <p style={{ color: 'var(--text-primary)', lineHeight: '1.5' }}>{selectedBill.relevance_rationale}</p>
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Summary</h4>
                          <p style={{ color: 'var(--text-primary)', lineHeight: '1.5' }}>{selectedBill.ai_summary}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── Action History Tab ── */}
              {modalTab === 'history' && (
                <div className="modal-section-new">
                  <h4 className="section-title-new">ACTION HISTORY</h4>
                  {modalDetailsLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center' }}><i className="fa-solid fa-spinner fa-spin"></i> Loading action history...</div>
                  ) : (
                  <div className="action-history-list">
                    {(selectedBill.action_history?.length > 0 ? selectedBill.action_history : [{ date: selectedBill.last_action_date, text: selectedBill.last_action_text, source: selectedBill.origin_chamber }]).map((item, i) => (
                      <div key={i} className="history-item">
                        <div className="history-dot"></div>
                        <div className="history-content">
                          <div className="history-date">{formatDisplayDate(item.date)}</div>
                          <div className="history-desc">{item.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
      {/* ── Prompt Editor Modal ── */}
      {isPromptModalOpen && (
        <div className="modal-overlay active" onClick={e => e.target.classList.contains('modal-overlay') && setIsPromptModalOpen(false)}>
          <div className="modal-container detail-modal-new" style={{ maxWidth: '500px' }}>
            <button className="modal-close-btn" onClick={() => setIsPromptModalOpen(false)}>
              <i className="fa-solid fa-xmark"></i>
            </button>

            <div className="modal-header-new" style={{ marginBottom: '1.5rem', paddingBottom: '1rem' }}>
              <h2 className="modal-title-new" style={{ fontSize: '1.5rem' }}>
                {editingPrompt ? 'Edit Tracking Interest' : 'Add Tracking Interest'}
              </h2>
            </div>

            <form onSubmit={handleSavePrompt} className="prefs-form" style={{ background: 'none', border: 'none', padding: 0 }}>
              <div className="prefs-field">
                <label>Tracking Prompt text <span style={{ color: 'var(--c-teal)' }}>*</span></label>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
                  Describe what legislation you want to track (e.g. "Track farm animal welfare bills").
                </p>
                <textarea
                  rows="3"
                  value={modalPromptText}
                  onChange={e => setModalPromptText(e.target.value)}
                  placeholder="e.g. factory farming, wildlife trafficking, animal testing"
                  required
                />
              </div>

              <div className="prefs-field">
                <label>Digest Notification Frequency</label>
                <div className="input-with-icon">
                  <i className="fa-regular fa-calendar"></i>
                  <select
                    value={modalPromptFrequency}
                    onChange={e => setModalPromptFrequency(e.target.value)}
                  >
                    <option value="daily">Daily Digest</option>
                    <option value="weekly">Weekly Digest</option>
                  </select>
                </div>
              </div>

              <div className="prefs-actions" style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPromptModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-floppy-disk"></i> {editingPrompt ? 'Save Changes' : 'Add Interest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
