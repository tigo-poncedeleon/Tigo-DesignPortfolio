# Tigo-DesignPortfolio

The source of <https://www.tigoponcedeleon.com>.

| folder | what it is |
| --- | --- |
| `live-portfolio/` | the site. Vercel's Root Directory: a push to `main` deploys it. Its README says how it is put together. |
| `resume-src/` | the source of the résumé the site links to, `live-portfolio/PoncedeLeon-Resume.pdf` (and of the applications copy beside it) |
| `archive/` | the sites it replaced, kept for reference and never served |

To run the site on this Mac:

```sh
python3 live-portfolio/tools/serve.py
```

and open <http://localhost:8793>.
