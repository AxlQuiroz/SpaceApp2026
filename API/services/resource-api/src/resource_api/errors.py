class ResourceError(Exception):
    """Error público seguro; nunca incluye la respuesta ni credenciales del proveedor."""

    def __init__(self, code: str, message: str, status: int = 502,
                 provider: str | None = None, transient: bool = False,
                 retry_after: int | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.provider = provider
        self.transient = transient
        self.retry_after = retry_after
