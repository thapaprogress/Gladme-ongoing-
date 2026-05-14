import sqlite3
import bcrypt

# New password to set for all users
NEW_PASSWORD = "GladME@2026"

conn = sqlite3.connect('gladme_v4.db')
cursor = conn.cursor()

# Hash the new password
hashed = bcrypt.hashpw(NEW_PASSWORD.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

# Update all users
cursor.execute("UPDATE users SET password_hash = ?", (hashed,))
conn.commit()

# Confirm
cursor.execute("SELECT id, email, name, role FROM users")
users = cursor.fetchall()
conn.close()

print("=== PASSWORD RESET COMPLETE ===\n")
print(f"New password set for all accounts: {NEW_PASSWORD}\n")
print(f"{'ID':<4} {'Email':<25} {'Name':<15} {'Role'}")
print("-" * 65)
for uid, email, name, role in users:
    print(f"{uid:<4} {email:<25} {name:<15} {role}")

print("\n=== LOGIN CREDENTIALS ===")
for uid, email, name, role in users:
    print(f"  Email   : {email}")
    print(f"  Password: {NEW_PASSWORD}")
    print()
