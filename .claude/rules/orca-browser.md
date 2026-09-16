# Browser: Orca first, never Chrome

For localhost / desk UI, drive Orca's embedded browser
(`orca tab create --url …`). Do not start Playwright, Chrome DevTools,
or system Chrome. That path opens extra windows and burns session credits.

Fallback: Aside in a **new** window, only if Orca cannot host after retry
or Sam names Aside. Never attach to Sam's live Aside session.

Computer Use is for OS windows only, not Edgeways pages.
