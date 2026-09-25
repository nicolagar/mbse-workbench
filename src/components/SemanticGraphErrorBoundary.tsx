import { Component, type ReactNode } from "react";
export class SemanticGraphErrorBoundary extends Component<{ children: ReactNode; onLegacy: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <section className="card p-4" role="alert"><p>The semantic view could not be displayed. Your project and existing tools remain available.</p><button className="btn mt-3" onClick={this.props.onLegacy}>Open legacy view</button></section> : this.props.children;
  }
}
