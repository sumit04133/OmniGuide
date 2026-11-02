import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import init_db, SessionLocal
from app.services.seed_data import seed_demo_data
from app.api.health import router as health_router
from app.api.guidelines import router as guidelines_router, facts_router
from app.api.reviews import router as reviews_router
from app.api.demo import router as demo_router
from app.api.campaigns import router as campaigns_router
from app.api.redteam import router as redteam_router
from app.api.assets import router as assets_router
from app.api.integrations import router as integrations_router
from app.api.regulatory import router as regulatory_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("omniguide")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables on startup
    logger.info("Initializing database tables...")
    init_db()

    # Seed demo data if not present
    db = SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
    
    logger.info(f"{settings.PROJECT_NAME} v{settings.VERSION} backend started successfully.")
    yield
    logger.info("Shutting down OmniGuide backend.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI brand governance workspace that explains, not just rejects. Powered by FastAPI and Google Gemini Flash.",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handler for unhandled errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please check server logs."}
    )

# Mount API Routers
app.include_router(health_router, prefix=settings.API_V1_PREFIX)
app.include_router(guidelines_router, prefix=settings.API_V1_PREFIX)
app.include_router(facts_router, prefix=settings.API_V1_PREFIX)
app.include_router(reviews_router, prefix=settings.API_V1_PREFIX)
app.include_router(campaigns_router, prefix=settings.API_V1_PREFIX)
app.include_router(redteam_router, prefix=settings.API_V1_PREFIX)
app.include_router(assets_router, prefix=settings.API_V1_PREFIX)
app.include_router(integrations_router, prefix=settings.API_V1_PREFIX)
app.include_router(regulatory_router, prefix=settings.API_V1_PREFIX)
app.include_router(demo_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "team": "NovaForge",
        "tagline": "AI brand governance that explains, not just rejects",
        "docs_url": "/docs",
        "health_url": f"{settings.API_V1_PREFIX}/health"
    }
