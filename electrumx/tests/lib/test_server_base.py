import asyncio
from unittest.mock import Mock

import pytest

from electrumx.lib.server_base import ServerBase


@pytest.mark.asyncio
async def test_windows_main_task_cancellation_uses_orderly_shutdown(monkeypatch):
    server = object.__new__(ServerBase)
    server.logger = Mock()
    started = asyncio.Event()

    async def serve(shutdown_event):
        started.set()
        await shutdown_event.wait()

    server.serve = serve
    monkeypatch.setattr('electrumx.lib.server_base.platform.system',
                        lambda: 'Windows')

    task = asyncio.create_task(server.run())
    await started.wait()
    task.cancel()
    await task

    messages = [call.args[0] for call in server.logger.info.call_args_list]
    assert 'shutting down' in messages
    assert 'shutdown complete' in messages
    server.logger.warning.assert_called_once_with(
        'received Windows console interrupt, initiating shutdown')
