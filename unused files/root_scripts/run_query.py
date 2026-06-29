from dotenv import load_dotenv
load_dotenv()
from ai_translator import generate_dhis2_url, fetch_query_result

q = "give the data of TX_TB :NEW on ART Screened Positive for meru county"
print('QUESTION:', q)
url = generate_dhis2_url(q)
print('GENERATED_URL:', url)
if not url:
    print('No URL generated')
else:
    res = fetch_query_result(url, export_csv=False, user_question=q)
    print('RESULT_OK:', res.get('ok'))
    print('TOTAL_ROWS:', res.get('total'))
    if res.get('message'):
        print('MESSAGE:', res.get('message'))
    
