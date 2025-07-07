#!/usr/bin/env python3
"""
Simple HTTP server to serve the GaggiMate firmware flasher.
This is needed because ESP Web Tools requires HTTPS or localhost to work.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

# Change to the script's directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = 8000

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow cross-origin requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Add proper MIME types
        if self.path.endswith('.json'):
            self.send_header('Content-Type', 'application/json')
        elif self.path.endswith('.bin'):
            self.send_header('Content-Type', 'application/octet-stream')
        super().end_headers()

def main():
    try:
        with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
            print(f"🚀 GaggiMate Firmware Flasher Server")
            print(f"📡 Serving at http://localhost:{PORT}")
            print(f"🌐 Open http://localhost:{PORT}/flasher.html in Chrome/Edge")
            print(f"⏹️  Press Ctrl+C to stop the server")
            print()
            
            # Try to open the browser automatically
            try:
                webbrowser.open(f'http://localhost:{PORT}/flasher.html')
                print("🔗 Browser should open automatically...")
            except Exception as e:
                print(f"⚠️  Could not open browser automatically: {e}")
                print(f"   Please open http://localhost:{PORT}/flasher.html manually")
            
            print()
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n👋 Server stopped.")
        sys.exit(0)
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
