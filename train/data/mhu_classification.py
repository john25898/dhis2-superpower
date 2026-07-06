# MHU (Mobile Health Units) Classification Data
# Source: CHAK DHIS2 (ereporting.chak.or.ke:8500) and CHAK Visuals (4) PBIX
# Date: 2026-07-05
#
# The CHAK MHU project group (s2rT0VCU6VM) contains 11 facilities.
# "Owner_Short" classification from PBIX MFlist table determines FBO vs Government.
# Based on facility naming patterns:

FACILITY_CLASSIFICATION = {
    "Faith Based / FBO": [
        {"id": "dLQjsqOgttT", "name": "Mulango (AIC) Health Centre",       "denom": "AIC",      "level": 5},
        {"id": "syjqhftfG5l", "name": "Kapsowar (AIC) Hospital",           "denom": "AIC",      "level": 5},
        {"id": "qsSIimN71Bx", "name": "Zombe (AIC) Health Centre",         "denom": "AIC",      "level": 5},
        {"id": "AawtXdUefwb", "name": "AIC Litein Mission Hospital",       "denom": "AIC",      "level": 5},
        {"id": "AmbExKcweHi", "name": "Kiengu PCEA Dispensary",            "denom": "PCEA",     "level": 5},
        {"id": "ag64ujDJHs6", "name": "Nyanchwa Adventist Hospital",       "denom": "Adventist", "level": 5},
        {"id": "EhJ2SBfPRSW", "name": "Kendu Adventist Hospital",          "denom": "Adventist", "level": 5},
        {"id": "gEEJqBQ2vqX", "name": "Maseno Mission Hospital",           "denom": "Mission",  "level": 5},
    ],
    "Government / Public": [
        {"id": "pZP7AaTtwYq", "name": "Churo Health Centre",              "denom": "Public",  "level": 5},
        {"id": "VKU1Pm3yNeW", "name": "Kiereni Dispensary",               "denom": "Public",  "level": 5},
        {"id": "hiLD4yCxIAC", "name": "Katakani Dispensary",              "denom": "Public",  "level": 5},
    ],
}

# All 71 "Mobile" facilities from CHAK DHIS2 (broader list including Beyond Zero etc.)
# Sorted alphabetically
ALL_MOBILE_FACILITIES = [
    "Amuma Mobile Dispensary",
    "Arbajahan Nomadic Mobile Clinic",
    "BEYOND ZERO MOBILE CLINIC",
    "Baringo County Beyond Zero Mobile Clinic",
    "Beyond  Zero Mobile Clinic (Transnzoia county) delete",
    "Beyond Zero Mobile Clinic (Meru)",
    "Beyond Zero Mobile Clinic Endebess",
    "Beyond Zero Mobile Clinic Machakos",
    "Beyond Zero Mobile Clinic(Busia)",
    "Beyond Zero Mobile Clinic(Kajiado County)",
    "Beyond Zero Mobile Clinic(Kwale)",
    "Beyond Zero Mobile Medical Clinic (Butere)",
    "Beyond Zero Mobile Medical Clinic (Kerugoya)",
    "Beyond Zero Mobile Medical Clinic (Kilifi)",
    "Beyond Zero Mobile Medical Clinic (Kisii)",
    "Beyond Zero Mobile Medical Clinic (Kisumu)",
    "Beyond Zero Mobile Medical Clinic (Kitui)",
    "Beyond Zero Mobile Medical Clinic (Kitui)",
    "Beyond Zero Mobile Medical Clinic (Lamu)",
    "Beyond Zero Mobile Medical Clinic (Mombasa County)",
    "Beyond Zero Mobile Medical Clinic (Taita Taveta)",
    "Beyond Zero Mobile Medical Clinic(Isiolo County)",
    "Beyond Zero Mobile clinic",
    "Bomet county Beyond Zero mobile clinic",
    "Bungoma Beyond Zero Mobile Unit",
    "CHAT Mobile Clinic",
    "CLOSED Daka Mobile",
    "Community Health Trust (CHAT) Mobile Clinic",
    "Elgeyo Marakwet County Beyond Zero Mobile Clinic",
    "Garissa Beyond Zero Mobile Clinic",
    "Gilgil Beyond Zero Mobile Clinic",
    "Homabay County Beyond Zero Mobile Clinic",
    "Huruma Mobile Clinic",
    "Kabarnet Eye Mobile Clinic Unit",
    "Kacheliba Mobile Clinic",
    "Kakamega County Beyond Zero Mobile Clinic",
    "Kericho County Beyond Zero Mobile Clinic",
    "Kiambu County Beyond Zero Mobile Clinic",
    "Kipkegenda (Mobile)",
    "Kitale Mobile Clinic",
    "Kotaruk Mobile Community Health",
    "Kotaruk mobile clinic",
    "Kuresoi North Beyond Zero Mobile Clinic",
    "Kuresoi South Beyond Zero Mobile Clinic",
    "Laikipia county Beyond zero mobile Clinic",
    "Life Water Ndege Mobile Clinic",
    "Maasai Community Health Mobile",
    "Makueni County Beyond Zero Mobile CLINIC",
    "Marsabit County Beyond Zero Mobile Clinic",
    "Mercy Mobile Clinic (Kipkelion)",
    "Mercy Mobile Clinic (Molo)",
    "Mobile Clinics",
    "Mobile clinic",
    "Mogotio Mobile",
    "Mpalla Mobile Clinic",
    "NAKURU NORTH BEYOND ZERO MOBILE CLINIC",
    "Naivasha Beyond Zero Mobile Clinic",
    "Nakuru beyond zero mobile clinic",
    "Nandi County Beyond Zero Mobile Clinic",
    "Njoro beyond zero mobile clinic",
    "Samburu Beyond Zero Mobile Clinic",
    "Siaya County Referral Beyond Zero Mobile Clinic",
    "St Martin De Porres (Mobile)",
    "Takaba Nomadic Mobile",
    "Tenwek Mobile",
    "Tharaka Nithi County Beyond Zero Mobile Clinic",
    "Turkana County Beyond Zero Campaign Mobile Clinic",
    "Uasingishu County Beyond Zero Mobile Clinic",
    "Wajir Beyond Zero Mobile Clinic",
    "West Pokot County Beyond Zero Mobile Clinic",
    "West Pokot County Beyond Zero Mobile Clinic",
]

# For each facility in the MHU project, we need the MOH 717 data set UIDs
# to query their workload. This will be obtained by hitting:
#   GET https://hiskenya.dha.go.ke/api/dataSets.json?filter=displayName:ilike:MOH 717&fields=id,displayName
# Then using the dataset UID to extract data element UIDs.
