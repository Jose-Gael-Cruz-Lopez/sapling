"""
Shared pytest configuration for the Sapling backend test suite.

Adds the backend root to sys.path so all module imports resolve correctly
regardless of where pytest is invoked from.
"""
import sys
import os

# Ensure `import config`, `import db.connection`, etc. all resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
