const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function normalizePrivateKey(key) {
  if (!key) return '';
  if (key.startsWith('0x')) return key;
  if (/^[a-fA-F0-9]{64}$/.test(key)) return `0x${key}`;
  return key;
}

function updateEnvFile(filePath, updates) {
  let content = '';
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    content = '';
  }
  let next = content;
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}="${value}"`;
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(next)) {
      next = next.replace(regex, line);
    } else {
      if (next.length && !next.endsWith('\n')) next += '\n';
      next += `${line}\n`;
    }
  }
  fs.writeFileSync(filePath, next, 'utf8');
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const contractsEnvPath = path.join(repoRoot, 'contracts', '.env');
  const backendEnvPath = path.join(repoRoot, 'backend', '.env');

  const envFile = parseEnvFile(contractsEnvPath);
  const rpcUrl = envFile.SOMNIA_TEST_HTTP || envFile.SOMNIA_HTTP || process.env.SOMNIA_TEST_HTTP;
  const privateKey = normalizePrivateKey(
    envFile.DEPLOYER_PRIVATE_KEY || envFile.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
  );

  if (!rpcUrl) {
    throw new Error('Missing SOMNIA_TEST_HTTP in contracts/.env');
  }
  if (!privateKey) {
    throw new Error('Missing DEPLOYER_PRIVATE_KEY in contracts/.env');
  }

  const registryArtifact = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, 'contracts', 'artifacts', 'contracts', 'StreamerRegistry.sol', 'StreamerRegistry.json'),
      'utf8'
    )
  );
  const vaultArtifact = JSON.parse(
    fs.readFileSync(
      path.join(repoRoot, 'contracts', 'artifacts', 'contracts', 'PaymentVault.sol', 'PaymentVault.json'),
      'utf8'
    )
  );

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('Deploying from:', wallet.address);

  const registryFactory = new ethers.ContractFactory(registryArtifact.abi, registryArtifact.bytecode, wallet);
  const registry = await registryFactory.deploy(wallet.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log('StreamerRegistry deployed to:', registryAddress);

  const vaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
  const initialFeeBps = 1000;
  const vault = await vaultFactory.deploy(registryAddress, initialFeeBps);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log('PaymentVault deployed to:', vaultAddress);

  updateEnvFile(contractsEnvPath, {
    REGISTRY_ADDRESS: registryAddress,
    VAULT_ADDRESS: vaultAddress
  });
  updateEnvFile(backendEnvPath, {
    REGISTRY_ADDRESS: registryAddress,
    VAULT_ADDRESS: vaultAddress
  });

  console.log('Updated contracts/.env and backend/.env');
}

main().catch((err) => {
  console.error('Deployment failed:', err?.message || err);
  process.exit(1);
});
