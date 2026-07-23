import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function Home() {
  const { t } = useTranslation();

  return (
    <div className="page">
      <h1>{t("home.title")}</h1>
      <p className="muted">{t("home.intro")}</p>
      <div className="card">
        <h2>{t("home.newHereTitle")}</h2>
        <p>
          {t("home.newHereBefore")} <Link to="/signup">{t("home.newHereLink")}</Link>{" "}
          {t("home.newHereAfter")}
        </p>
      </div>
      <div className="card">
        <h2>{t("home.exploreTitle")}</h2>
        <ul>
          <li><Link to="/game-masters">{t("home.exploreGameMasters")}</Link></li>
          <li><Link to="/game-systems">{t("home.exploreGameSystems")}</Link></li>
          <li><Link to="/game-log">{t("home.exploreGameLog")}</Link></li>
        </ul>
      </div>
    </div>
  );
}
