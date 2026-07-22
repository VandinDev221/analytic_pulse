class PulseApiError(Exception):
    def __init__(self, message: str, status: int, code: str | None = None, body=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.body = body
