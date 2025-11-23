import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { loadDeployments } from './deployments.ts'

// Load deployments before rendering
async function initApp() {
  try {
    console.log('🔄 Loading deployment addresses...');
    await loadDeployments();
    console.log('✅ Deployments loaded successfully');
    
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    document.getElementById('root')!.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-family: system-ui;">
        <div style="text-align: center; padding: 2rem; background: rgba(255,255,255,0.1); border-radius: 1rem; backdrop-filter: blur(10px);">
          <h1 style="font-size: 2rem; margin-bottom: 1rem;">⚠️ Failed to Load</h1>
          <p>Could not load deployment addresses.</p>
          <p style="margin-top: 1rem; font-size: 0.875rem; opacity: 0.8;">Check console for details.</p>
        </div>
      </div>
    `;
  }
}

initApp();
