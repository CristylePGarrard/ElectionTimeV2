# 🏛️ ElectionTime V2
### Utah Legislature Explorer · Follow the work behind the bills ✨

Ever wondered what your state legislators are working on—or what happens to the bills they sponsor?

**ElectionTime** is a little civic-data project that makes Utah legislative bill records easier to explore. Instead of digging through spreadsheets and official pages one record at a time, you can filter by legislator, chamber, district, and year, then browse the bills and their recorded outcomes.

The goal is simple: make legislative data feel a little less intimidating and a lot more approachable. 💛

---

## 🌼 What can you explore?

- **🔎 Find a legislator** — choose a representative or senator to explore their sponsored bills.
- **📍 Browse by district** — filter by House or Senate district. District numbers can overlap between chambers, so the dashboard keeps them separate.
- **📅 Compare years** — explore records from 2023 through 2026.
- **📊 See yearly bill activity** — a stacked bar chart separates bills into Passed, Failed, and Unverified categories.
- **🧮 Get the quick picture** — summary stats show the number of bills in the selected view, recorded outcomes, and a pass rate for bills with a known outcome.
- **📚 Search the bill table** — look up bill numbers, titles, sponsors, sessions, and outcomes, then follow links to official legislative records when available.

The filters work together, so you can start with a district, narrow down to a legislator, or explore a whole chamber. The idea is to help people start with what they know and discover the rest as they go.

## 💡 Why build this?

Public information is only useful when people can actually make sense of it.

ElectionTime is an experiment in making civic data easier to navigate for everyday Utahns—not just people who are comfortable with spreadsheets or business dashboards. It also explores how data analysis, thoughtful interface design, and clear explanations can work together to turn raw records into something useful.

This project is a work in progress. Future ideas include using geographic data to map legislative districts and making it easier to explore what is happening in a person's own area. 🗺️

## 🧭 How to use the dashboard

1. **Start with what you know.** Choose a legislator, chamber, district, or year.
2. **Look at the summary.** The cards and chart update to reflect the current selection.
3. **Explore the details.** Search the bill table and open official records for more information.
4. **Clear the filters** whenever you want to start exploring a different view.

## 🧪 Run it locally

The dashboard is a static HTML, CSS, and JavaScript app that loads its bill records from `data/dashboard_data.json`.

Because the browser fetches a JSON file, run it through a local web server rather than opening `index.html` directly.

From the repository directory, run:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser. Stop the server with `Ctrl+C`.

## 🛠️ Built with

- **HTML** for the page structure
- **CSS** for a responsive, editorial-inspired layout
- **Vanilla JavaScript** for filtering, summary calculations, chart rendering, and the bill table
- **JSON** for the dashboard's data source
- **GitHub Pages** for static hosting

No big framework required—just a small, focused front end built around the data. 🌱

## 🧾 A note about the data

This dashboard is intended for exploration and learning, not as an official source of legislative status.

- The dataset combines Utah legislative bill records with legislator roster information.
- Some legislator names may not match perfectly between sources, and some records may not have a matched district.
- **Passed** reflects the supplied passed-bill lists.
- **Failed** is currently an estimate: records missing from those supplied passed-bill lists are labeled Failed. That does **not** mean every bill has been independently checked against its complete legislative history.
- **Unverified** is kept separate when an outcome has not been verified, including special-session records where applicable.
- The pass rate is calculated using Passed and Failed records only; Unverified records are excluded.

Please check the linked official legislative record for authoritative information about an individual bill. If you spot a data issue or have an idea that would make the dashboard easier to use, feedback is welcome!

---

### 💛 Thanks for taking a look!

Civic data can be complicated. Hopefully this makes exploring it feel a little more human, one bill at a time. 🏛️✨
