# SPEC-006: Financial System
**Traces to**: PRD Section 4.5

## Financial Model

```python
class FinancialState(BaseModel):
    cash: float                    # Liquid money on hand
    checking: float                # Bank checking account
    savings: float                 # Savings account
    investments: dict              # {"stocks": 0, "bonds": 0, "401k": 0}
    monthly_income: float          # After-tax income
    monthly_expenses: dict         # {"rent": 0, "utilities": 0, "insurance": 0, ...}
    spending_history: list         # Transaction log
    disposition: str               # "frugal" | "moderate" | "comfortable" | "spendthrift"
    investment_style: str          # "conservative" | "balanced" | "aggressive"
    credit_score: float            # 300-850
    debt: dict                     # {"mortgage": 0, "car_loan": 0, "credit_card": 0}
```

## Income Sources

| Occupation | Monthly Income | Frequency |
|-----------|---------------|-----------|
| Teacher | $3,500-4,500 | Biweekly |
| Nurse | $4,000-5,500 | Biweekly |
| Tech Worker | $6,000-10,000 | Monthly |
| Shop Owner | $2,500-5,000 (variable) | Monthly |
| Librarian | $3,000-3,800 | Biweekly |
| Retired | $1,800-3,000 (pension/SS) | Monthly |
| Doctor | $10,000-15,000 | Monthly |
| Government Worker | $4,000-6,000 | Biweekly |
| Student (part-time) | $500-1,200 | Biweekly |
| Firefighter | $4,000-5,500 | Biweekly |

## Expenses

### Fixed Monthly
- Rent: $800-1,800 (apartment to house mortgage)
- Utilities: $100-250
- Insurance (health): $200-500
- Insurance (car): $80-200
- Internet/Phone: $80-150
- Groceries: $300-600

### Variable Daily
- Coffee at cafe: $3-6
- Lunch out: $8-15
- Dinner at restaurant: $15-40
- Grocery shopping: $30-80 per trip
- Gas: $40-60 per fill-up
- Entertainment: $10-50
- Books/supplies: $5-30

## Financial Behaviors

### Disposition Effects

| Disposition | Saving Rate | Dining Out | Investments | Risk Tolerance |
|------------|------------|------------|-------------|---------------|
| Frugal | 25-35% of income | Rare, prefers cooking | Conservative, steady | Low |
| Moderate | 15-25% | Occasional | Balanced portfolio | Medium |
| Comfortable | 10-15% | Regular | Mixed, some stocks | Medium-High |
| Spendthrift | 0-10% | Frequent, premium | Minimal savings | N/A (spends it) |

### Decision Triggers

Financial decisions are LLM-driven but prompted with context:
```python
prompt = f"""
You are {agent.name}. {financial_context}
Your disposition: {agent.financial.disposition}
Your investment style: {agent.financial.investment_style}

Current situation: {situation_description}
Options: {available_options}

What financial decision do you make? Consider your personality and situation.
"""
```

### Major Purchase Triggers
- Home renovation: after 5+ years of ownership, LLM-initiated
- New car: when current car is old, or life event (child)
- Investment changes: quarterly review, market events
- Emergency fund: when savings drop below 3-month expenses

## Transaction Recording

Every financial event creates a memory entry:
```python
class Transaction(BaseModel):
    timestamp: SimTime
    agent_id: str
    type: str           # "income" | "expense" | "transfer" | "investment"
    amount: float
    category: str       # "food" | "transport" | "entertainment" | "health" | ...
    description: str
    location_id: str
```
