import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from sqlalchemy import text

def reorder_price_columns():
    with app.app_context():
        # Create a temporary table with desired column order
        with db.engine.connect() as conn:
            try:
                # Create temporary table with desired column order
                conn.execute(text("""
                    CREATE TABLE prices_temp (
                        id INTEGER PRIMARY KEY AUTO_INCREMENT,
                        service_type VARCHAR(50) NOT NULL UNIQUE,
                        pounds INTEGER NOT NULL DEFAULT 0,
                        pence INTEGER NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                """))
                
                # Copy data from old table to new table
                conn.execute(text("""
                    INSERT INTO prices_temp (id, service_type, pounds, pence, created_at, updated_at)
                    SELECT id, service_type, pounds, pence, created_at, updated_at
                    FROM prices
                """))
                
                # Drop the old table
                conn.execute(text("DROP TABLE prices"))
                
                # Rename temporary table to original name
                conn.execute(text("RENAME TABLE prices_temp TO prices"))
                
                conn.commit()
                print("Price columns reordered successfully!")
                
            except Exception as e:
                print(f"Error during migration: {str(e)}")
                conn.rollback()
                raise e

if __name__ == '__main__':
    reorder_price_columns() 