from unittest import mock

import pytest
from aiorpcx import RPCError

from electrumx.server.session import ElectrumX


def transaction_session(response=None):
    session = mock.Mock()
    session.daemon_request = mock.AsyncMock(return_value=response)
    return session


@pytest.mark.asyncio
@pytest.mark.parametrize(
    'response',
    [
        '11' * 32,
        {'hex': '00' * 32, 'blockhash': 'ff' * 32},
        {'hex': '00' * 32, 'blockhash': None},
    ],
    ids=('backend-raw-response', 'confirmed-response', 'mempool-response'),
)
async def test_transaction_get_returns_verbose_daemon_response(response):
    session = transaction_session(response)

    result = await ElectrumX.transaction_get(session, 'ff' * 32, True)

    assert result == response
    session.bump_cost.assert_called_once_with(1.0)
    session.daemon_request.assert_awaited_once_with(
        'getrawtransaction', 'ff' * 32, True
    )


@pytest.mark.asyncio
async def test_transaction_get_defaults_to_non_verbose():
    response = 'cafebabe' * 64
    session = transaction_session(response)

    result = await ElectrumX.transaction_get(session, 'ff' * 32)

    assert result == response
    session.bump_cost.assert_called_once_with(1.0)
    session.daemon_request.assert_awaited_once_with(
        'getrawtransaction', 'ff' * 32, False
    )


@pytest.mark.asyncio
async def test_transaction_get_propagates_daemon_error():
    session = transaction_session()
    error = RPCError(1, 'some unhandled error')
    session.daemon_request.side_effect = error

    with pytest.raises(RPCError) as raised:
        await ElectrumX.transaction_get(session, 'ff' * 32, True)

    assert raised.value is error
    session.bump_cost.assert_called_once_with(1.0)
    session.daemon_request.assert_awaited_once_with(
        'getrawtransaction', 'ff' * 32, True
    )


@pytest.mark.asyncio
async def test_transaction_get_rejects_invalid_hash_without_daemon_call():
    session = transaction_session()

    with pytest.raises(RPCError, match='should be a transaction hash'):
        await ElectrumX.transaction_get(session, 'cafe')

    session.bump_cost.assert_not_called()
    session.daemon_request.assert_not_awaited()


@pytest.mark.asyncio
async def test_transaction_get_rejects_non_boolean_verbose():
    session = transaction_session()

    with pytest.raises(RPCError, match='verbose.*must be a boolean'):
        await ElectrumX.transaction_get(session, 'ff' * 32, 'yes')

    session.bump_cost.assert_not_called()
    session.daemon_request.assert_not_awaited()
