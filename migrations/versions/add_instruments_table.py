"""Add instruments table and migrate instrument data

Revision ID: add_instruments_table
Revises: 
Create Date: 2024-03-19

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime
import pytz

# revision identifiers, used by Alembic.
revision = 'add_instruments_table'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Create instruments table
    op.create_table('instruments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, default=lambda: datetime.now(pytz.timezone('Europe/London'))),
        sa.Column('updated_at', sa.DateTime(), nullable=False, default=lambda: datetime.now(pytz.timezone('Europe/London')), onupdate=lambda: datetime.now(pytz.timezone('Europe/London'))),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # Add default instruments
    op.execute("""
        INSERT INTO instruments (name, is_active, created_at, updated_at)
        VALUES 
            ('Guitar', true, NOW(), NOW()),
            ('Bass', true, NOW(), NOW()),
            ('Drums', true, NOW(), NOW()),
            ('Vocals', true, NOW(), NOW()),
            ('Keys', true, NOW(), NOW()),
            ('Production', true, NOW(), NOW())
    """)

    # Add instrument_id columns
    op.add_column('users', sa.Column('instrument_id', sa.Integer(), nullable=True))
    op.add_column('materials', sa.Column('instrument_id', sa.Integer(), nullable=True))
    op.add_column('sessions', sa.Column('instrument_id', sa.Integer(), nullable=True))

    # Create foreign key constraints
    op.create_foreign_key('fk_users_instrument', 'users', 'instruments', ['instrument_id'], ['id'])
    op.create_foreign_key('fk_materials_instrument', 'materials', 'instruments', ['instrument_id'], ['id'])
    op.create_foreign_key('fk_sessions_instrument', 'sessions', 'instruments', ['instrument_id'], ['id'])

    # Migrate existing instrument data
    # First, get all unique instruments from the existing tables
    op.execute("""
        INSERT INTO instruments (name, is_active, created_at, updated_at)
        SELECT DISTINCT instrument, true, NOW(), NOW()
        FROM (
            SELECT instrument FROM users WHERE instrument IS NOT NULL
            UNION
            SELECT instrument FROM materials WHERE instrument IS NOT NULL
            UNION
            SELECT instrument FROM sessions WHERE instrument IS NOT NULL
        ) AS unique_instruments
        WHERE instrument NOT IN (SELECT name FROM instruments)
    """)

    # Update users table
    op.execute("""
        UPDATE users u
        SET instrument_id = (
            SELECT id FROM instruments i WHERE i.name = u.instrument
        )
        WHERE u.instrument IS NOT NULL
    """)

    # Update materials table
    op.execute("""
        UPDATE materials m
        SET instrument_id = (
            SELECT id FROM instruments i WHERE i.name = m.instrument
        )
        WHERE m.instrument IS NOT NULL
    """)

    # Update sessions table
    op.execute("""
        UPDATE sessions s
        SET instrument_id = (
            SELECT id FROM instruments i WHERE i.name = s.instrument
        )
        WHERE s.instrument IS NOT NULL
    """)

    # Drop old instrument columns
    op.drop_column('users', 'instrument')
    op.drop_column('materials', 'instrument')
    op.drop_column('sessions', 'instrument')

def downgrade():
    # Add back the old instrument columns
    op.add_column('users', sa.Column('instrument', sa.String(length=50), nullable=True))
    op.add_column('materials', sa.Column('instrument', sa.String(length=50), nullable=True))
    op.add_column('sessions', sa.Column('instrument', sa.String(length=50), nullable=True))

    # Migrate data back
    op.execute("""
        UPDATE users u
        SET instrument = (
            SELECT name FROM instruments i WHERE i.id = u.instrument_id
        )
        WHERE u.instrument_id IS NOT NULL
    """)

    op.execute("""
        UPDATE materials m
        SET instrument = (
            SELECT name FROM instruments i WHERE i.id = m.instrument_id
        )
        WHERE m.instrument_id IS NOT NULL
    """)

    op.execute("""
        UPDATE sessions s
        SET instrument = (
            SELECT name FROM instruments i WHERE i.id = s.instrument_id
        )
        WHERE s.instrument_id IS NOT NULL
    """)

    # Drop foreign key constraints
    op.drop_constraint('fk_users_instrument', 'users', type_='foreignkey')
    op.drop_constraint('fk_materials_instrument', 'materials', type_='foreignkey')
    op.drop_constraint('fk_sessions_instrument', 'sessions', type_='foreignkey')

    # Drop instrument_id columns
    op.drop_column('users', 'instrument_id')
    op.drop_column('materials', 'instrument_id')
    op.drop_column('sessions', 'instrument_id')

    # Drop instruments table
    op.drop_table('instruments') 