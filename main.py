from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from typing import List, Dict
from datetime import date, timedelta
from pydantic import BaseModel

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

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
    custom: AmortizationResult | None = None
    difference: AmortizationComparisonDifference | None = None

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

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/calculate", response_model=AmortizationComparisonResult)
async def calculate(
    purchase_price: float = Form(...),
    interest_rate: float = Form(...),
    down_payment: float = Form(...),
    loan_term: int = Form(...),
    start_date: str = Form(...),
    custom_repayment: float = Form(None)
):
    orig_result = calculate_amortization(
        purchase_price=purchase_price,
        interest_rate=interest_rate,
        down_payment=down_payment,
        loan_term_years=loan_term,
        start_date=date.fromisoformat(start_date)
    )
    custom_result = None
    diff = None
    if custom_repayment and custom_repayment > orig_result.summary.monthly_payment:
        custom_result = calculate_amortization(
            purchase_price=purchase_price,
            interest_rate=interest_rate,
            down_payment=down_payment,
            loan_term_years=loan_term,
            start_date=date.fromisoformat(start_date),
            custom_repayment=custom_repayment
        )
        diff = AmortizationComparisonDifference(
            total_payments_diff=round(orig_result.summary.total_payments - custom_result.summary.total_payments, 2),
            months_diff=len(orig_result.schedule) - len(custom_result.schedule)
        )
    return AmortizationComparisonResult(
        original=orig_result,
        custom=custom_result,
        difference=diff
    )
