from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from finance import (
    AmortizationComparisonDifference,
    AmortizationComparisonResult,
    calculate_amortization
)
from datetime import date
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

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

def main():
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    main()
