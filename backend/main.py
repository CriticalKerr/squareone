# A simple starter file that boots up the server

import os
import uvicorn
from app.main import app

if __name__ == "__main__":
    # Get port from environment variable (Cloud Run sets this)
    port = int(os.getenv("PORT", 8000))
    
    # Check if we're in production (Cloud Run sets K_SERVICE)
    is_production = os.getenv("K_SERVICE") is not None or os.getenv("ENVIRONMENT") == "production"
    
    if is_production:
        # Production settings for Cloud Run
        print("🚀 Starting in production mode")
        uvicorn.run(
            app, 
            host="0.0.0.0", 
            port=port,
            log_level="info"
            # NO --reload in production!
        )
    else:
        # Development settings
        print("🛠️  Starting in development mode")
        uvicorn.run(
            app, 
            host="0.0.0.0", 
            port=port, 
            log_level="debug",
            reload=True
        )