import { execSync } from 'child_process';

try {
  console.log('Adding all changes...');
  execSync('git add .', { cwd: '/vercel/share/v0-project', stdio: 'inherit' });

  console.log('Checking git status...');
  const status = execSync('git status --short', { cwd: '/vercel/share/v0-project' }).toString();
  
  if (!status.trim()) {
    console.log('No changes to commit');
    process.exit(0);
  }

  console.log('Committing changes...');
  execSync('git commit -m "Add Paystack payment integration: 17 cedis fee with auto-approval"', { 
    cwd: '/vercel/share/v0-project', 
    stdio: 'inherit' 
  });

  console.log('Pushing to GitHub...');
  execSync('git push origin shop-creation-payment', { 
    cwd: '/vercel/share/v0-project', 
    stdio: 'inherit' 
  });

  console.log('✓ Changes successfully pushed to GitHub!');
} catch (error) {
  console.error('Error pushing changes:', error.message);
  process.exit(1);
}
