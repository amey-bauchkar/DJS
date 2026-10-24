"""E4.4 tests: the learned sequence model scores, per-tool rate z-score, reference refresh, drift explanation.
Old suites run against E4.4 in test_e421_rules_on_e44.py / test_engine_e431_on_e44.py."""
import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from mandate.engine_e44 import Engine  # noqa: E402

PROC = ["search_suppliers", "get_prices", "read_supplier_doc", "create_purchase_request", "send_email"]


class Clock:
    def __init__(self, step=7.0):
        self.t, self.step = 1_800_000_000.0, step
    def __call__(self):
        self.t += self.step
        return self.t


def mature(step=7.0):
    e = Engine(clock=Clock(step))
    e.register_agent("p1", "procurement", task="supplier_review")
    e.learn([{"agent_id": "p1", "tool": PROC[i % len(PROC)], "destination": "internal"} for i in range(100)])
    e.record_rates("p1", [8, 9, 8, 10, 9, 8])
    return e


def D(e, tool, **args):
    return e.decide({"agent_id": "p1", "tool": tool, "args": args})


def F(r):
    return [f["factor"] for f in r["factors"]]


class TestE44(unittest.TestCase):
    def test_sequence_model_scores_and_is_deviation(self):
        self.assertEqual(Engine(clock=Clock()).cfg["points"]["learned_sequence_anomaly"], 0)
        e = mature()
        seen = [f for _ in range(12) for f in D(e, "search_suppliers", q="valves")["factors"] if f["factor"] == "learned_sequence_anomaly"]
        for f in seen:
            self.assertEqual(f["points"], 0)

    def test_sequence_model_cannot_deny_alone(self):
        e = mature()
        for _ in range(3):
            r = D(e, "search_suppliers", q="valves")
            self.assertNotEqual(r["response"], "DENY")

    def test_tool_rate_spike(self):
        e = mature(step=2.0)
        hit = [r for r in (D(e, "get_prices", item="valves") for _ in range(10)) if "tool_rate_spike" in F(r)]
        self.assertTrue(hit)

    def test_normal_pace_no_tool_rate_spike(self):
        e = mature(step=7.0)
        for t in PROC * 3:
            r = D(e, t, q="x", item="x", supplier="x", amount=1) if t in ("search_suppliers", "get_prices", "read_supplier_doc") else None
            if r:
                self.assertNotIn("tool_rate_spike", F(r))

    def test_reference_refresh_only_when_clean(self):
        e = mature()
        e.cfg["ref_refresh_every"] = 3
        e.accum["p1"] = 50.0
        before = dict(e.ref_tool["p1"])
        for t in PROC:
            D(e, t, q="x", item="x")
        self.assertEqual(dict(e.ref_tool["p1"]), before)   # noisy accumulator: no refresh

    def test_explain_drift_shape(self):
        e = mature()
        for _ in range(4):
            D(e, "search_suppliers", q="valves")
        x = e.explain_drift("p1")
        for k in ("verdict", "js_divergence", "accumulator", "deviation_points_by_factor", "largest_tool_shifts", "recent_decisions", "confidence"):
            self.assertIn(k, x)


if __name__ == "__main__":
    unittest.main()
