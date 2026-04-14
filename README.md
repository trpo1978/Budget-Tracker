# Budget Tracker

A lightweight, YNAB-style budgeting app. Enter your current bank balance,
create spending categories, assign money from your balance into each
category, and log transactions to track what you've spent.

## Features

- **Bank balance** as the source of truth for money available
- **Categories** with editable name, target, and assigned amount
- **"Ready to Assign"** running total (balance − everything assigned)
- **Transactions** logged against a category, reducing its Available amount
- **Progress bars** showing assigned-vs-target per category
- **Export / Import / Reset** via JSON
- **Local-only** — data is stored in your browser's `localStorage`

## Running it

No build step. Just open `index.html` in a browser:

```sh
# macOS
open index.html
# Linux
xdg-open index.html
# Or serve locally
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How it works

1. Enter your current bank balance and click **Save**.
2. Click **+ Add Category** to create categories (e.g. Groceries, Rent, Fun).
3. Set a **Target** (what you want to budget monthly) and **Assigned**
   (what you're funding it with right now from your balance).
4. Click **+ Add Transaction** to log spending. The category's Available
   amount decreases as you spend.
5. **Ready to Assign** in the header shows how much of your balance
   isn't yet allocated to a category.

## Files

- `index.html` — structure and layout
- `styles.css` — styles
- `app.js` — state, persistence, rendering, and event handlers
