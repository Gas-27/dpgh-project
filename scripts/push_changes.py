#!/usr/bin/env python3
import subprocess
import os

os.chdir('/vercel/share/v0-project')

try:
    # Configure git if needed
    subprocess.run(['git', 'config', 'user.email', 'v0[bot]@users.noreply.github.com'], check=False)
    subprocess.run(['git', 'config', 'user.name', 'v0[bot]'], check=False)
    
    # Add all changes
    print("Adding all changes...")
    subprocess.run(['git', 'add', '-A'], check=True)
    
    # Check if there are changes to commit
    result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True)
    if result.stdout.strip():
        print("Changes found. Committing...")
        message = "feat: Add Paystack payment integration for shop creation\n\n- Add 17 cedis registration fee\n- Auto-approve stores after successful payment\n- Integrate payment modal into shop onboarding flow\n\nCo-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>"
        subprocess.run(['git', 'commit', '-m', message], check=True)
        
        # Push to current branch
        print("Pushing to GitHub...")
        subprocess.run(['git', 'push', 'origin', 'HEAD'], check=True)
        print("✓ Changes pushed successfully!")
    else:
        print("No changes to commit")
        
except subprocess.CalledProcessError as e:
    print(f"Error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
