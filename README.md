<div align="center">

<h2>Cardano Indexer</h2>

<p>A Cardano event-driven indexer, implemented in Deno and built upon the Ogmios solution.</p>

<p align="center">
  <a href="https://github.com/studiowebux/cardano-indexer/issues">Report Bug</a>
  ·
  <a href="https://github.com/studiowebux/cardano-indexer/issues">Request Feature</a>
</p>
</div>

---

## About

- **Indexer:** Developed using Ogmios and Deno, this Cardano indexer serves as the core of our project.
- **Message Transfer:** We employ Apache Kafka for efficient communication between the indexer and processor components.
- **Data Storage:** MongoDB is utilized to store block data and other relevant information, ensuring flexibility and swift adjustments based on custom requirements.
- **API & Dashboard:** Hono facilitates a straightforward API, while HTMX enables creation of a basic yet functional dashboard.
- **Monitoring:** Prometheus is integrated for comprehensive tracking of metrics and ensuring smooth project operation.

**Documentation:** https://cardano.studiowebux.com

---

## Contributing

1. Fork the project
2. Create a Feature Branch
3. Commit your changes
4. Push your changes
5. Create a PR

<details>
<summary>Working with your local branch</summary>

**Branch Checkout:**

```bash
git checkout -b <feature|fix|release|chore|hotfix>/prefix-name
```

> Your branch name must starts with [feature|fix|release|chore|hotfix] and use a / before the name;
> Use hyphens as separator;
> The prefix correspond to your Kanban tool id (e.g. abc-123)

**Keep your branch synced:**

```bash
git fetch origin
git rebase origin/master
```

**Commit your changes:**

```bash
git add .
git commit -m "<feat|ci|test|docs|build|chore|style|refactor|perf|BREAKING CHANGE>: commit message"
```

> Follow this convention commitlint for your commit message structure

**Push your changes:**

```bash
git push origin <feature|fix|release|chore|hotfix>/prefix-name
```

**Examples:**

```bash
git checkout -b release/v1.15.5
git checkout -b feature/abc-123-something-awesome
git checkout -b hotfix/abc-432-something-bad-to-fix
```

```bash
git commit -m "docs: added awesome documentation"
git commit -m "feat: added new feature"
git commit -m "test: added tests"
```

</details>

## License

Distributed under the MIT License. See LICENSE for more information.

## Contact

- Tommy Gingras @ tommy@studiowebux.com | Studio Webux

<div>
<b> | </b>
<a href="https://www.buymeacoffee.com/studiowebux" target="_blank"
      ><img
        src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
        alt="Buy Me A Coffee"
        style="height: 30px !important; width: 105px !important"
        height="30"
        width="105"
/></a>
<b> | </b>
<a href="https://webuxlab.com" target="_blank"
      ><img
        src="https://webuxlab-static.s3.ca-central-1.amazonaws.com/logoAmpoule.svg"
        alt="Webux Logo"
        style="height: 30px !important"
        height="30"
/> Webux Lab</a>
<b> | </b>
</div>
