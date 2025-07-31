import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/App.css";

// Debug logging for React mounting
console.log("🔄 Starting React application mount...");

const root = document.getElementById("root");
if (!root) {
  console.error("❌ Root element not found");
  throw new Error("Root element not found");
}

console.log("✅ Root element found, creating React root...");

// First try a minimal React component to isolate the issue
function MinimalTest() {
  console.log("✅ MinimalTest component rendering");
  return React.createElement("div", {
    style: { 
      padding: "20px", 
      background: "#e8f5e8", 
      color: "#2d5016",
      fontFamily: "monospace",
      border: "2px solid #4caf50"
    }
  }, "✅ REACT MOUNTED SUCCESSFULLY - Minimal test component working!");
}

try {
  console.log("🔄 Creating React root...");
  const reactRoot = ReactDOM.createRoot(root);
  console.log("✅ React root created successfully");
  
  console.log("🔄 Testing minimal React component first...");
  reactRoot.render(React.createElement(MinimalTest));
  console.log("✅ Minimal React component rendered");
  
  // Wait 2 seconds then try full App
  setTimeout(() => {
    console.log("🔄 Now attempting full App component render...");
    try {
      reactRoot.render(
        React.createElement(React.StrictMode, null,
          React.createElement(App)
        )
      );
      console.log("✅ Full App component render initiated");
    } catch (appError) {
      console.error("❌ Error rendering full App component:", appError);
      
      // Show App error but keep minimal component visible
      root.innerHTML += `
        <div style="padding: 20px; font-family: monospace; background: #fee; color: #c00; margin-top: 10px; border: 2px solid #f44336;">
          <h3>App Component Error</h3>
          <p>Minimal React works, but full App failed:</p>
          <pre>${appError instanceof Error ? appError.message : String(appError)}</pre>
          <pre>${appError instanceof Error ? appError.stack : ''}</pre>
        </div>
      `;
    }
  }, 2000);
  
} catch (error) {
  console.error("❌ Fatal error during React root creation:", error);
  
  // Fallback error display
  root.innerHTML = `
    <div style="padding: 20px; font-family: monospace; background: #fee; color: #c00;">
      <h3>React Root Creation Error</h3>
      <p>Failed to create React root.</p>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
      <pre>${error instanceof Error ? error.stack : ''}</pre>
      <p>Check the console for more details.</p>
    </div>
  `;
}
