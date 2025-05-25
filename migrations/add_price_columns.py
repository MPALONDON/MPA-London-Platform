import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from sqlalchemy import text

def add_price_columns():
    with app.app_context():
        # Add the new columns and migrate data
        with db.engine.connect() as conn:
            try:
                # Add pounds column
                conn.execute(text("""
                    ALTER TABLE prices 
                    ADD COLUMN pounds INTEGER NOT NULL DEFAULT 0
                """))
            except Exception as e:
                if "Duplicate column name" not in str(e):
                    raise e
                
            try:
                # Add pence column
                conn.execute(text("""
                    ALTER TABLE prices 
                    ADD COLUMN pence INTEGER NULL
                """))
            except Exception as e:
                if "Duplicate column name" not in str(e):
                    raise e
            
            # Migrate data from amount to pounds and pence
            try:
                conn.execute(text("""
                    UPDATE prices 
                    SET pounds = FLOOR(amount / 100),
                        pence = amount % 100
                    WHERE amount > 0
                """))
                
                # Drop the old amount column
                conn.execute(text("""
                ALTER TABLE prices 
                    DROP COLUMN amount
                """))
            except Exception as e:
                if "Unknown column" not in str(e):
                    raise e
            
            conn.commit()
        print("Price columns updated successfully!")

if __name__ == '__main__':
    add_price_columns() 