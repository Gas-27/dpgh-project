#!/bin/bash

cd /vercel/share/v0-project

# Configure git if needed
git config user.name "v0[bot]" || true
git config user.email "v0[bot]@users.noreply.github.com" || true

# Add all changes
git add -A

# Commit with a descriptive message
git commit -m "feat: Add Paystack payment integration for shop creation with auto-approval

- Integrate payment modal to shop creation flow
- Set registration fee to 17 cedis
- Auto-approve store after successful payment
- Redirect to agent dashboard after payment completion

Co-authored-by: v0[bot] <v0[bot]@users.noreply.github.com>"

# Push to the current branch
git push origin HEAD

echo "Changes pushed successfully!"
