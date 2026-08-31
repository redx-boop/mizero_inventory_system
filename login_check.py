import sqlite3

def check_db():
    try:
        # Looking for a common database location based on typical patterns
        conn = sqlite3.connect('database.db')
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Tables: {tables}")
        
        if ('users',) in tables:
            cursor.execute("SELECT email, password FROM users LIMIT 5;")
            users = cursor.fetchall()
            print(f"Users: {users}")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

check_db()
