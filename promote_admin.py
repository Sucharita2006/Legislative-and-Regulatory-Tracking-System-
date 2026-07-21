import sys
sys.path.insert(0, '.')
from backend.app.database import engine
from sqlalchemy import text

def promote_user(email: str):
    with engine.connect() as conn:
        # Check if user exists
        res = conn.execute(text("SELECT id, is_admin FROM user_profiles WHERE email = :email"), {"email": email}).first()
        if not res:
            print(f"Error: No user profile found for email '{email}'. Please sign up first.")
            return
        
        print(f"Found user: ID={res[0]}, is_admin={res[1]}")
        conn.execute(
            text("UPDATE user_profiles SET is_admin = true WHERE email = :email"),
            {"email": email}
        )
        conn.commit()
        print(f"Successfully promoted user '{email}' to administrator!")

if __name__ == "__main__":
    email = "ayushmangela@gmail.com"
    print(f"Promoting {email} to admin...")
    try:
        promote_user(email)
    except Exception as e:
        print(f"Failed to connect or update database: {e}")
