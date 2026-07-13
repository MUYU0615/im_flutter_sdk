from __future__ import annotations


def describe_case_steps(steps: str) -> None:
    """Attach Chinese manual reproduction steps to the current Allure case."""
    try:
        import allure

        allure.dynamic.description(steps)
    except Exception:
        pass
