from typing import List, Optional
from datetime import date, timedelta
from pydantic import BaseModel

class AmortizationPayment(BaseModel):
    payment_number: int
    date: date
    payment: float
    principal: float
    interest: float
    balance: float

class AmortizationSummary(BaseModel):
    total_payments: float
    total_interest: float
    payoff_date: date
    monthly_payment: float

class AmortizationResult(BaseModel):
    schedule: List[AmortizationPayment]
    summary: AmortizationSummary

class AmortizationComparisonDifference(BaseModel):
    total_payments_diff: float
    months_diff: int

class AmortizationComparisonResult(BaseModel):
    original: AmortizationResult
    custom: Optional[AmortizationResult] = None
    difference: Optional[AmortizationComparisonDifference] = None

def calculate_amortization(
    purchase_price: float,
    interest_rate: float,
    down_payment: float,
    loan_term_years: int,
    start_date: date,
    custom_repayment: float = None
) -> AmortizationResult:
    """
    Calculate the amortization schedule for a fixed-rate loan.
    If custom_repayment is provided and greater than the minimum, use it as the monthly payment.
    """
    principal = purchase_price - down_payment
    monthly_rate = interest_rate / 100 / 12
    n_payments = loan_term_years * 12
    if monthly_rate == 0:
        min_monthly_payment = principal / n_payments
    else:
        min_monthly_payment = principal * (monthly_rate * (1 + monthly_rate) ** n_payments) / ((1 + monthly_rate) ** n_payments - 1)
    monthly_payment = min_monthly_payment
    if custom_repayment and custom_repayment > min_monthly_payment:
        monthly_payment = custom_repayment
    schedule = []
    balance = principal
    total_interest = 0.0
    i = 1
    while balance > 0:
        interest = balance * monthly_rate
        principal_paid = min(monthly_payment - interest, balance)
        payment = principal_paid + interest
        balance -= principal_paid
        total_interest += interest
        payment_date = start_date + timedelta(days=30 * (i - 1))
        schedule.append(AmortizationPayment(
            payment_number=i,
            date=payment_date,
            payment=round(payment, 2),
            principal=round(principal_paid, 2),
            interest=round(interest, 2),
            balance=round(max(balance, 0), 2)
        ))
        if balance <= 0:
            break
        i += 1
    summary = AmortizationSummary(
        total_payments=round(sum(p.payment for p in schedule), 2),
        total_interest=round(total_interest, 2),
        payoff_date=schedule[-1].date,
        monthly_payment=round(monthly_payment, 2)
    )
    return AmortizationResult(schedule=schedule, summary=summary)

