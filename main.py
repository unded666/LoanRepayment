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

class AmortizationResult(BaseModel):
    schedule: List[AmortizationPayment]
    summary: AmortizationSummary

def calculate_amortization(
    purchase_price: float,
    interest_rate: float,
    down_payment: float,
    loan_term_years: int,
    start_date: date
) -> AmortizationResult:
    """
    Calculate the amortization schedule for a fixed-rate loan.
    """
    principal = purchase_price - down_payment
    monthly_rate = interest_rate / 100 / 12
    n_payments = loan_term_years * 12
    if monthly_rate == 0:
        monthly_payment = principal / n_payments
    else:
        monthly_payment = principal * (monthly_rate * (1 + monthly_rate) ** n_payments) / ((1 + monthly_rate) ** n_payments - 1)
    schedule = []
    balance = principal
    total_interest = 0.0
    for i in range(1, n_payments + 1):
        interest = balance * monthly_rate
        principal_paid = monthly_payment - interest
        if balance - principal_paid < 0:
            principal_paid = balance
            monthly_payment = principal_paid + interest
        balance -= principal_paid
        total_interest += interest
        payment_date = start_date + timedelta(days=30 * (i - 1))
        schedule.append(AmortizationPayment(
            payment_number=i,
            date=payment_date,
            payment=round(monthly_payment, 2),
            principal=round(principal_paid, 2),
            interest=round(interest, 2),
            balance=round(max(balance, 0), 2)
        ))
        if balance <= 0:
            break
    summary = AmortizationSummary(
        total_payments=round(monthly_payment * len(schedule), 2),
        total_interest=round(total_interest, 2),
        payoff_date=schedule[-1].date
    )
    return AmortizationResult(schedule=schedule, summary=summary)

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/calculate", response_model=AmortizationResult)
async def calculate(
    purchase_price: float = Form(...),
    interest_rate: float = Form(...),
    down_payment: float = Form(...),
    loan_term: int = Form(...),
    start_date: str = Form(...)
):
    result = calculate_amortization(
        purchase_price=purchase_price,
        interest_rate=interest_rate,
        down_payment=down_payment,
        loan_term_years=loan_term,
        start_date=date.fromisoformat(start_date)
    )
    return result

