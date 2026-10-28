# Here is a breakdown of the data work 

## Numbered bills for a session

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

I save the general session files like 

```py
f"{save_dir}/utah_bills_{year}.csv"
f"{save_dir}/utah_bills_{year}.json"
```

and the special session files like

```py
df.to_csv(f"{save_dir}/special_session_2_2025.csv", index=False)
```

I may remove the json file since I only used the csv when I combine the data. 

The files with all the numbered bills are named Utah_bills_{year}

## Passed bills for a session

The Utah state legislature website allows you to download a csv file of bills that were passed during the session. 

You can download the passed bills [here](https://le.utah.gov/asp/passedbills/passedbills.asp?session=2026GS)

The files with all the passed bills are named passedBills-{year}

## Legislatures

The reps for each session can also be found on the Utah legislative website
[here](https://le.utah.gov/asp/roster/roster.asp)

I was lazy about getting this data and just copied and pasted the data into a google spreadsheet

The files with all the reps are named utah_legislatures_{year}

## Candidate Filings

The 2026 filings were found [here](https://vote.utah.gov/2026-candidate-filings/)
I downloaded the spreadsheet from the vote.utah.gov website and split the info into 6 tabs for 

- Federal Offices
- State Offices
- Utah Senate
- Utah House
- State School Board
- Judicial Retention

## Data work

I did the data work in a google collab Jupyter notebook. 
