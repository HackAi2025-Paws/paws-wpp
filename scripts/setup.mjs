#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const shouldRegenerate = args.includes('--fresh') || args.includes('--regenerate');
const shouldStartApp = !args.includes('--no-start');
const verbose = args.includes('--verbose');

console.log('🚀 Setting up Paws WhatsApp Application...\n');

// Helper function to run commands
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    if (verbose) {
      console.log(`Running: ${command} ${args.join(' ')}`);
    }

    const child = spawn(command, args, {
      stdio: verbose ? 'inherit' : 'pipe',
      shell: true,
      cwd: path.join(__dirname, '..'),
      ...options
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
      }
    });

    child.on('error', reject);
  });
}

async function main() {
  try {
    // Step 1: Setup Redis
    console.log('📦 Setting up Redis...');
    if (shouldRegenerate) {
      await runCommand('npm', ['run', 'redis:reset']);
      console.log('✅ Redis reset and started');
    } else {
      await runCommand('npm', ['run', 'redis:up']);
      console.log('✅ Redis started');
    }

    // Wait a moment for Redis to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Setup Database
    console.log('🗄️  Setting up Database...');
    if (shouldRegenerate) {
      await runCommand('npx', ['prisma', 'db', 'push']);
      console.log('✅ Database schema pushed');
    }

    await runCommand('npx', ['prisma', 'generate']);
    console.log('✅ Prisma client generated');

    // Step 3: Verify setup
    console.log('🔍 Verifying setup...');

    // Check if Redis is healthy
    try {
      await new Promise((resolve, reject) => {
        const check = spawn('docker', ['exec', 'paws-wpp-redis', 'redis-cli', 'ping'], {
          stdio: 'pipe'
        });

        let output = '';
        check.stdout.on('data', (data) => output += data.toString());
        check.on('close', (code) => {
          if (code === 0 && output.includes('PONG')) {
            resolve();
          } else {
            reject(new Error('Redis health check failed'));
          }
        });
      });
      console.log('✅ Redis is healthy');
    } catch (error) {
      console.warn('⚠️  Redis health check failed:', error.message);
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📋 What was set up:');
    console.log(`   • Redis: ${shouldRegenerate ? 'Reset and started' : 'Started'}`);
    console.log(`   • Database: ${shouldRegenerate ? 'Schema pushed and' : ''} Client generated`);

    console.log('\n🔧 Useful commands:');
    console.log('   • npm run test:session  - Test session management');
    console.log('   • npm run redis:dev     - Start Redis with GUI');
    console.log('   • npm run redis:logs    - View Redis logs');

    if (shouldStartApp) {
      console.log('\n🚀 Starting development server...\n');
      // Start the dev server (this will keep running)
      const devProcess = spawn('npm', ['run', 'dev'], {
        stdio: 'inherit',
        shell: true,
        cwd: path.join(__dirname, '..')
      });

      // Handle Ctrl+C gracefully
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        devProcess.kill('SIGINT');
        process.exit(0);
      });

      devProcess.on('close', (code) => {
        process.exit(code);
      });
    } else {
      console.log('\n💡 Run "npm run dev" to start the development server');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Make sure Docker is running');
    console.log('   • Check your .env file has required variables');
    console.log('   • Run with --verbose for detailed logs');
    process.exit(1);
  }
}

// Help message
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🚀 Paws WhatsApp Setup Script

Usage: node scripts/setup.js [options]

Options:
  --fresh, --regenerate    Reset Redis and regenerate database
  --no-start              Don't start the development server
  --verbose               Show detailed command output
  --help, -h              Show this help message

Examples:
  node scripts/setup.js                    # Quick setup and start
  node scripts/setup.js --fresh            # Full reset and start
  node scripts/setup.js --no-start         # Setup only, don't start server
  node scripts/setup.js --fresh --verbose  # Full reset with detailed logs
`);
  process.exit(0);
}

main();