# Here is a breakdown of the data work 

I used google collab (python Jupyter notebook) for the data work. 

I wrote a scraper to get all the bills that were numbered each session. 
The URL for the bills that are numbered is formatted like 

 ```py
f"https://le.utah.gov/billlist.jsp?session={year}GS"
```

for the general sessions with {year} being replaced with the year for the data. 
For the special sessions the url is formatted like

```py
f"https://le.utah.gov/billlist.jsp?session={year}S{session_number}"
```

where year is the year of the session and session_number is the special session number. 


```python
rows.append({
                    "Category": category,
                    "Bill Number": bill_number,
                    "Bill Title": bill_title,
                    "Bill Sponsor Raw": sponsor_raw,
                    "Bill Sponsor": sponsor,
                    "Bill Date Raw": date_raw,
                    "Bill Date (utc_iso)": bill_date,
                    "Bill URL": bill_url
                })

```
