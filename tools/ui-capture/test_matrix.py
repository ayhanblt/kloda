import sys

sys.dont_write_bytecode = True

import copy
import json
import re
import tempfile
import unittest
from pathlib import Path

import matrix as m

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
REAL = HERE / "matrix.json"


def m_locale(locale: str) -> str:
    return f"apps/desktop/src/shared/i18n/locales/{locale}.json"


def union_values(relative: str, type_name: str) -> set[str]:
    source = (REPO / relative).read_text(encoding="utf-8")
    declaration = re.search(rf"type {type_name}\s*=\s*([^;]+);", source)
    assert declaration, f"{type_name} not found in {relative}"
    return set(re.findall(r"'([^']+)'", declaration.group(1)))


class RealMatrixTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.matrix = m.load(REAL)

    def test_loads(self):
        self.assertEqual(self.matrix["version"], 1)
        self.assertGreater(len(self.matrix["rows"]), 0)

    def test_desktop_settings_fingerprint_covers_rendered_language_keys(self):
        row = next(r for r in self.matrix["rows"] if r["id"] == "desktop.settings")
        paths = set(self.matrix["common"]["desktop"]) | set(row["dependencies"]) | set(self.matrix["driverSources"]["desktop-renderer"])
        locale = json.loads((REPO / m_locale("tr")).read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            for rel in paths | {m_locale("tr")}:
                (repo / rel).parent.mkdir(parents=True, exist_ok=True)
                (repo / rel).write_text("x", encoding="utf-8")

            def digest(change=lambda data: None):
                data = copy.deepcopy(locale)
                change(data)
                (repo / m_locale("tr")).write_text(json.dumps(data), encoding="utf-8")
                fingerprint = m.fingerprint(self.matrix, "desktop.settings", "tr", repo)
                self.assertEqual(fingerprint["status"], "known")
                return fingerprint["digest"]
            base = digest()
            self.assertNotEqual(base, digest(lambda d: d["ui"]["languages"].update(tr="changed name")))
            self.assertNotEqual(base, digest(lambda d: d["ui"].update(language="changed legend")))
            self.assertEqual(base, digest(lambda d: d.update(zzUnrelatedKey="x")))

    def test_every_desktop_route_is_listed(self):
        routes = union_values("apps/desktop/src/shared/navigation/desktop-route.ts", "DesktopRoute")
        listed = {row["ref"].get("route") for row in m.listing(self.matrix)["rows"] if row["platform"] == "desktop"}
        self.assertEqual(routes - listed, set())

    def test_every_mobile_page_is_listed(self):
        pages = union_values("apps/mobile/src/shared/model/mobile-navigation.ts", "MobilePage")
        listed = {row["ref"].get("page") for row in m.listing(self.matrix)["rows"] if row["platform"] == "ios"}
        self.assertEqual(pages - listed, set())

    def test_counts_sum_to_total_cells(self):
        report = m.listing(self.matrix)
        self.assertEqual(sum(report["totals"].values()), report["totalCells"])
        self.assertEqual(report["totalCells"], len(m.cells(self.matrix)))
        for row in report["rows"]:
            self.assertEqual(sum(row["cells"].values()), 12)

    def test_desktop_large_cells_are_not_ready(self):
        chosen = m.select(self.matrix, driver="desktop-renderer", size="large")
        self.assertTrue(chosen)
        self.assertTrue(all(cell.status != m.READY for cell in chosen))
        self.assertTrue(all(cell.reason for cell in chosen))

    def test_select_by_screen_and_locale(self):
        chosen = m.select(self.matrix, screen="settings", locale="de")
        self.assertTrue(all(cell.locale == "de" for cell in chosen))
        self.assertEqual({cell.driver for cell in chosen}, {"desktop-renderer", "ios-native-entry"})

    def test_select_matches_row_id(self):
        chosen = m.select(self.matrix, screen="mobile.settings")
        self.assertEqual({cell.row for cell in chosen}, {"mobile.settings"})

    def test_unknown_screen_is_rejected(self):
        with self.assertRaises(m.MatrixError):
            m.select(self.matrix, screen="no-such-screen")

    def test_empty_selection_is_rejected(self):
        with self.assertRaises(m.MatrixError):
            m.select(self.matrix, screen="desktop.tray-os", driver="ios-native-entry")

    def test_listing_exposes_cell_overrides(self):
        rows = {row["id"]: row for row in m.listing(self.matrix)["rows"]}
        overrides = rows["desktop.settings"]["overrides"]
        self.assertEqual(len(overrides), 6)
        self.assertTrue(all(item["cell"].endswith("/large") and item["status"] == "state_unavailable" and item["reason"] for item in overrides))
        self.assertEqual(rows["mobile.settings"]["overrides"], [])

    def test_ready_ios_rows_are_exactly_the_supported_set(self):
        ready = {row["id"] for row in self.matrix["rows"] if row["driver"] == "ios-native-entry" and row["status"] == m.READY}
        self.assertEqual(ready, {"mobile.welcome", "mobile.settings", "mobile.provider-generic"})

    def test_settings_bottom_cells_are_unavailable(self):
        chosen = m.select(self.matrix, screen="mobile.settings-bottom")
        self.assertEqual(len(chosen), 12)
        self.assertTrue(all(cell.status == "state_unavailable" and cell.reason for cell in chosen))

    def test_shell_rows_carry_tab_label_keys_and_version_source(self):
        tabs = {"statusUi.title", "statusUi.photos", "statusUi.targets", "statusUi.settings"}
        for row in self.matrix["rows"]:
            if row["platform"] == "ios" and row["ref"].get("page") not in ("welcome", "pairing") and row["id"] != "mobile.lock-screen-cards":
                self.assertTrue(tabs <= set(row["localeKeys"]), row["id"])
            if "apps/mobile/src/shared/config/app-version.ts" in row["dependencies"]:
                self.assertIn("apps/mobile/app.json", row["dependencies"], row["id"])

    def test_frozen_sub_screen_page_map(self):
        expected = [
            ("desktop.backup", "backup"), ("desktop.backup-storage", "backup-storage"), ("desktop.jobs", "jobs"),
            ("mobile.provider-cloud-nextcloud", "provider-cloud-nextcloud"),
            ("mobile.provider-cloud-password", "provider-cloud-password"),
            ("mobile.provider-cloud-oauth", "provider-cloud-oauth"),
        ]
        rows = {row["id"]: row for row in self.matrix["rows"]}
        self.assertEqual([(rid, rows[rid]["screen"]) for rid, _ in expected], expected)
        self.assertNotIn("mobile.provider-cloud", rows)
        for rid, _ in expected:
            self.assertEqual(len([c for c in m.cells(self.matrix) if c.row == rid]), 12, rid)
        self.assertEqual(rows["desktop.jobs"]["ref"]["step"], "activity")
        self.assertEqual(rows["desktop.backup-storage"]["ref"]["step"], "storage")
        self.assertNotEqual(rows["desktop.backup-storage"]["status"], m.READY)

    def test_cell_id_format(self):
        cell = m.select(self.matrix, screen="welcome", driver="ios-native-entry", locale="tr", theme="dark", size="normal")[0]
        self.assertEqual(cell.id, "mobile.welcome/tr/dark/normal")


def base_matrix() -> dict:
    return {
        "version": 1,
        "variants": {"locales": ["tr", "en"], "themes": ["light"], "sizes": ["normal"]},
        "common": {"desktop": ["common.txt"]},
        "localeFiles": {"desktop": "locales/{locale}.json"},
        "driverSources": {"desktop-renderer": ["driver.py"], "ios-native-entry": [], "android-legacy": []},
        "rows": [{
            "id": "desktop.a", "platform": "desktop", "family": "f", "screen": "a", "driver": "desktop-renderer",
            "status": "ready", "ref": {}, "dependencies": ["dep.txt"], "localeKeys": ["a"],
        }],
    }


class InvalidMatrixTest(unittest.TestCase):
    def assert_invalid(self, mutate):
        data = base_matrix()
        mutate(data)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "matrix.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaises(m.MatrixError):
                m.load(path)

    def test_base_matrix_is_valid(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "matrix.json"
            path.write_text(json.dumps(base_matrix()), encoding="utf-8")
            self.assertEqual(len(m.cells(m.load(path))), 2)

    def test_duplicate_row_id(self):
        self.assert_invalid(lambda d: d["rows"].append(copy.deepcopy(d["rows"][0])))

    def test_duplicate_locale_in_row(self):
        self.assert_invalid(lambda d: d["rows"][0].update(locales=["tr", "tr"]))

    def test_unknown_driver(self):
        self.assert_invalid(lambda d: d["rows"][0].update(driver="nope"))

    def test_non_ready_without_reason(self):
        self.assert_invalid(lambda d: d["rows"][0].update(status="blocked"))

    def test_dotdot_dependency(self):
        self.assert_invalid(lambda d: d["rows"][0].update(dependencies=["../secret.txt"]))

    def test_unknown_version(self):
        self.assert_invalid(lambda d: d.update(version=2))


class FingerprintTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.repo = Path(self._tmp.name)
        self.matrix = base_matrix()
        self.write("common.txt", "common")
        self.write("dep.txt", "dep")
        self.write("driver.py", "driver")
        self.write_locale("en", {"a": {"x": "1"}, "b": "unrelated"})

    def write(self, rel, text):
        target = self.repo / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")

    def write_locale(self, locale, data):
        self.write(f"locales/{locale}.json", json.dumps(data))

    def fingerprint(self):
        return m.fingerprint(self.matrix, "desktop.a", "en", self.repo)

    def test_reuse_when_nothing_changed(self):
        first, second = self.fingerprint(), self.fingerprint()
        self.assertEqual(first["status"], "known")
        self.assertEqual(m.reuse_decision(first, second), {"decision": "reuse", "changed": []})

    def test_recapture_lists_changed_file(self):
        first = self.fingerprint()
        self.write("dep.txt", "dep changed")
        decision = m.reuse_decision(first, self.fingerprint())
        self.assertEqual(decision, {"decision": "recapture", "changed": ["dep.txt"]})

    def test_unrelated_locale_key_keeps_digest(self):
        first = self.fingerprint()
        self.write_locale("en", {"a": {"x": "1"}, "b": "changed elsewhere"})
        self.assertEqual(first["digest"], self.fingerprint()["digest"])

    def test_related_locale_key_changes_digest(self):
        first = self.fingerprint()
        self.write_locale("en", {"a": {"x": "2"}, "b": "unrelated"})
        decision = m.reuse_decision(first, self.fingerprint())
        self.assertEqual(decision, {"decision": "recapture", "changed": ["localeKeys"]})

    def test_missing_dependency_is_unknown(self):
        first = self.fingerprint()
        (self.repo / "dep.txt").unlink()
        current = self.fingerprint()
        self.assertEqual(current["status"], "unknown")
        self.assertEqual(current["files"]["dep.txt"], "MISSING")
        self.assertEqual(m.reuse_decision(first, current)["decision"], "unknown")

    def test_unknown_is_never_reused_even_when_equal(self):
        (self.repo / "dep.txt").unlink()
        current = self.fingerprint()
        self.assertEqual(m.reuse_decision(current, self.fingerprint())["decision"], "unknown")

    def test_missing_locale_prefix_is_unknown(self):
        self.write_locale("en", {"b": "no prefix a"})
        self.assertEqual(self.fingerprint()["status"], "unknown")

    def test_row_change_recaptures_with_row_key(self):
        first = self.fingerprint()
        self.matrix["rows"][0]["screen"] = "other"
        self.assertEqual(m.reuse_decision(first, self.fingerprint()), {"decision": "recapture", "changed": ["row"]})
        self.matrix["rows"][0]["screen"] = "a"
        self.matrix["rows"][0].update(status="blocked", reason="gate")
        self.assertEqual(m.reuse_decision(first, self.fingerprint())["changed"], ["row"])

    def test_driver_source_change_recaptures(self):
        first = self.fingerprint()
        self.write("driver.py", "driver v2")
        self.assertEqual(m.reuse_decision(first, self.fingerprint()), {"decision": "recapture", "changed": ["driver.py"]})

    def test_shell_tab_key_change_recaptures_and_app_json_change_recaptures(self):
        self.matrix["rows"][0]["localeKeys"] = ["a", "statusUi.title"]
        self.matrix["rows"][0]["dependencies"].append("app.json")
        self.write("app.json", '{"version": "1"}')
        self.write_locale("en", {"a": {"x": "1"}, "statusUi": {"title": "Home", "other": "o"}})
        first = self.fingerprint()
        self.write_locale("en", {"a": {"x": "1"}, "statusUi": {"title": "Home", "other": "changed"}})
        self.assertEqual(m.reuse_decision(first, self.fingerprint())["decision"], "reuse")
        self.write_locale("en", {"a": {"x": "1"}, "statusUi": {"title": "Start", "other": "changed"}})
        self.assertEqual(m.reuse_decision(first, self.fingerprint()), {"decision": "recapture", "changed": ["localeKeys"]})
        self.write("app.json", '{"version": "2"}')
        self.assertEqual(m.reuse_decision(first, self.fingerprint())["changed"], ["app.json", "localeKeys"])

    def test_fingerprint_body_keys(self):
        self.assertEqual(sorted(self.fingerprint()), ["digest", "files", "localeKeys", "row", "status"])

    def test_previous_none_recaptures(self):
        self.assertEqual(m.reuse_decision(None, self.fingerprint())["decision"], "recapture")


if __name__ == "__main__":
    unittest.main()
