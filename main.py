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
from pydantic import BaseModel
import requests

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

class CalculationResponseWithCurrency(BaseModel):
    result: AmortizationComparisonResult
    currency_symbol: str

COUNTRY_CURRENCY = {
    'US': '$', 'CA': '$', 'GB': '£', 'DE': '€', 'FR': '€', 'ES': '€', 'IT': '€', 'IE': '€',
    'JP': '¥', 'CN': '¥', 'IN': '₹', 'AU': '$', 'NZ': '$', 'SG': '$', 'ZA': 'R', 'CH': 'CHF',
    'SE': 'kr', 'NO': 'kr', 'DK': 'kr', 'PL': 'zł', 'CZ': 'Kč', 'RU': '₽', 'BR': 'R$', 'MX': '$',
    'KR': '₩', 'TR': '₺', 'IL': '₪', 'SA': '﷼', 'AE': 'د.إ', 'HK': '$', 'MY': 'RM', 'TH': '฿',
    'ID': 'Rp', 'PH': '₱', 'NG': '₦', 'EG': '£', 'PK': '₨', 'BD': '৳', 'UA': '₴', 'AR': '$',
    'CL': '$', 'CO': '$', 'PE': 'S/', 'VE': 'Bs', 'VN': '₫', 'TW': 'NT$', 'HU': 'Ft',
}

def get_currency_symbol_from_ip(ip: str) -> str:
    try:
        resp = requests.get(f"https://ipapi.co/{ip}/json/", timeout=2)
        if resp.status_code == 200:
            data = resp.json()
            country = data.get('country')
            if country and country in COUNTRY_CURRENCY:
                return COUNTRY_CURRENCY[country]
    except Exception:
        pass
    return '$'  # Default to USD

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/calculate", response_model=CalculationResponseWithCurrency)
async def calculate(
    request: Request,
    purchase_price: float = Form(...),
    interest_rate: float = Form(...),
    down_payment: float = Form(...),
    loan_term: int = Form(...),
    start_date: str = Form(...),
    custom_repayment: float = Form(None)
):
    client_ip = request.client.host if request.client else None
    if client_ip in ("127.0.0.1", "::1", None):
        xff = request.headers.get("x-forwarded-for")
        if xff:
            client_ip = xff.split(",")[0].strip()
    currency_symbol = get_currency_symbol_from_ip(client_ip or "")
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
    result = AmortizationComparisonResult(
        original=orig_result,
        custom=custom_result,
        difference=diff
    )
    return CalculationResponseWithCurrency(result=result, currency_symbol=currency_symbol)

def main():
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    main()
