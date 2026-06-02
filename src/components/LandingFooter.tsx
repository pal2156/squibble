function Mark({ height = 26 }: { height?: number }) {
  return (
    <img
      src="/landing/Logo2Squibble.png"
      alt=""
      style={{ display: "block", height: `${height}px`, width: "auto", flexShrink: 0, marginRight: "-4px" }}
      aria-hidden="true"
    />
  );
}

export function LandingFooter() {
  return (
    <footer id="company">
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="mark-row">
            <Mark height={28} />
            <span className="name">Squibble</span>
          </div>
          <div className="tag">Land research positions, effortlessly.</div>
        </div>
        <div className="footer-col">
          <h4>Product</h4>
          <ul>
            <li><a href="/#product">How it works</a></li>
            <li><a href="/#pricing">Pricing</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Company</h4>
          <ul>
            <li><a href="/#company">About</a></li>
            <li><a href="/#company">Contact</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Legal</h4>
          <ul>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms of Service</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        © 2026 Squibble. Built for students, by students.
      </div>
    </footer>
  );
}
