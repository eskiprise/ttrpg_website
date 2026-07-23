import { Link } from "react-router-dom";

export function Home() {
  return (
    <div className="page">
      <h1>Welcome to the Club</h1>
      <p className="muted">
        We're a tabletop RPG club running D&D, Delta Green, and more. Browse our
        Game Masters, check the log of every session we've played, and join us
        at the table.
      </p>
      <div className="card">
        <h2>New here?</h2>
        <p>
          Membership is by admin approval. <Link to="/signup">Submit a signup request</Link>{" "}
          and we'll get back to you.
        </p>
      </div>
      <div className="card">
        <h2>Explore</h2>
        <ul>
          <li><Link to="/game-masters">Meet our Game Masters</Link></li>
          <li><Link to="/game-systems">See what we play</Link></li>
          <li><Link to="/game-log">Browse the Game Log</Link></li>
        </ul>
      </div>
    </div>
  );
}
