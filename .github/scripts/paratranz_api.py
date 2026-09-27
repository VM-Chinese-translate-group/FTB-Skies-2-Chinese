import time
from pathlib import Path
from typing import Any

import requests

API_BASE_URL = "https://paratranz.cn/api"
DEFAULT_TIMEOUT = (10, 120)
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


class ParaTranzClient:
    """Small client for the ParaTranz endpoints used by this repository."""

    def __init__(
        self,
        token: str,
        *,
        base_url: str = API_BASE_URL,
        session: requests.Session | None = None,
        timeout: tuple[int, int] = DEFAULT_TIMEOUT,
        max_attempts: int = 3,
        sleep=time.sleep,
    ) -> None:
        token = token.strip()
        if not token:
            raise ValueError("ParaTranz token cannot be empty.")
        if max_attempts < 1:
            raise ValueError("max_attempts must be at least 1.")

        self.authorization = (
            token if token.lower().startswith("bearer ") else f"Bearer {token}"
        )
        self.base_url = base_url.rstrip("/")
        self.session = session or requests.Session()
        self.timeout = timeout
        self.max_attempts = max_attempts
        self.sleep = sleep

    def _request(self, method: str, path: str, *, retry: bool = True, **kwargs):
        headers = {"Accept": "application/json", "Authorization": self.authorization}
        headers.update(kwargs.pop("headers", {}))
        attempts = self.max_attempts if retry else 1
        file_positions = []
        for file_value in kwargs.get("files", {}).values():
            file_object = file_value[1] if isinstance(file_value, tuple) else file_value
            if hasattr(file_object, "tell") and hasattr(file_object, "seek"):
                file_positions.append((file_object, file_object.tell()))

        for attempt in range(attempts):
            if attempt:
                for file_object, position in file_positions:
                    file_object.seek(position)
            try:
                response = self.session.request(
                    method,
                    f"{self.base_url}/{path.lstrip('/')}",
                    headers=headers,
                    timeout=self.timeout,
                    **kwargs,
                )
            except requests.RequestException:
                if attempt + 1 == attempts:
                    raise
                self.sleep(2**attempt)
                continue

            if (
                response.status_code in RETRYABLE_STATUS_CODES
                and attempt + 1 < attempts
            ):
                retry_after = response.headers.get("Retry-After", "")
                delay = float(retry_after) if retry_after.isdigit() else 2**attempt
                response.close()
                self.sleep(delay)
                continue

            response.raise_for_status()
            return response

        raise RuntimeError("ParaTranz request exhausted all attempts.")

    @staticmethod
    def _json(response: requests.Response, expected_type: type, endpoint: str):
        try:
            payload = response.json()
        except requests.exceptions.JSONDecodeError as error:
            raise RuntimeError(
                f"ParaTranz returned invalid JSON for {endpoint}."
            ) from error
        if not isinstance(payload, expected_type):
            raise RuntimeError(
                f"ParaTranz returned an unexpected response for {endpoint}: "
                f"expected {expected_type.__name__}."
            )
        return payload

    def get_files(self, project_id: int) -> list[dict[str, Any]]:
        endpoint = f"projects/{int(project_id)}/files"
        response = self._request("GET", endpoint)
        return self._json(response, list, endpoint)

    def get_file_translation(
        self, project_id: int, file_id: int
    ) -> list[dict[str, Any]]:
        endpoint = (
            f"projects/{int(project_id)}/files/{int(file_id)}/translation"
        )
        response = self._request("GET", endpoint)
        return self._json(response, list, endpoint)

    def create_file(self, project_id: int, file_path: Path, path: str):
        endpoint = f"projects/{int(project_id)}/files"
        with Path(file_path).open("rb") as source_file:
            return self._request(
                "POST",
                endpoint,
                retry=False,
                files={"file": (Path(file_path).name, source_file)},
                data={"path": path},
            )

    def update_file(self, project_id: int, file_id: int, file_path: Path):
        endpoint = f"projects/{int(project_id)}/files/{int(file_id)}"
        with Path(file_path).open("rb") as source_file:
            return self._request(
                "POST",
                endpoint,
                files={"file": (Path(file_path).name, source_file)},
            )

    def delete_file(self, project_id: int, file_id: int):
        endpoint = f"projects/{int(project_id)}/files/{int(file_id)}"
        return self._request("DELETE", endpoint)
