import electrumx.lib.tx as tx_lib
from electrumx.lib.util import pack_varbytes
import pytest

tests = [
    "020000000192809f0b234cb850d71d020e678e93f074648ed0df5affd0c46d3bcb177f"
    "9ccf020000008b483045022100c5403bcf86c3ae7b8fd4ca0d1e4df6729cc1af05ff95"
    "d9726b43a64b41dd5d9902207fab615f41871885aa3062fc7d8f8d9d3dcbc2e4867c5d"
    "96dd7a176b99e927924141040baa4271a82c5f1a09a5ea63d763697ca0545b6049c4dd"
    "8e8d099dd91f2da10eb11e829000a82047ac56969fb582433067a21c3171e569d1832c"
    "34fdd793cfc8ffffffff030000000000000000226a20195ce612d20e5284eb78bb28c9"
    "c50d6139b10b77b2d5b2f94711b13162700472bfc53000000000001976a9144a519c63"
    "f985ba5ab8b71bb42f1ecb82a0a0d80788acf6984315000000001976a9148b80536aa3"
    "c460258cda834b86a46787c9a2b0bf88ac00000000",
    "0200000003ee933f16c93d433bfd45426e94ddb4c0406aecac66f1c23a9e55151430c2"
    "b4c4a70000006b483045022100c940624ddbefcf86f3a3d820347de9c695204583a3ce"
    "9977c45cb1d6f69d577202205e0d9e9c0bfc2993160edad71cd1474b6308d990a89a54"
    "c80d7c62295edd2a394121039999e7c52a1447916b2af30478669c4e6e3ce52b895da7"
    "78f0b46b73f8ea6f00feffffff30be91ac83fee19e06304732027a39f9ec9018c5aae1"
    "159bf1c5de53dea61785fc0200006a473044022057cee17c3e123864336bdd6373e4bc"
    "0bf030ca70dd078520705930a4168610d0022061fdeedfbeb0b89c3b20db220799978b"
    "c94e11e4155b810b8b59df019b3f1859412103e2074e4387eeb3b1dec2fc8b953b0c13"
    "c53d0d3b7b676e1b3ca75ee606ecf750feffffffdd462d60e51be69451f06c36ba4490"
    "aaad8ebf40501dd27341e9c64a5f633324000000006a473044022043511ab874f0037c"
    "5726b1efc69fcdb638fac74ab3f6766eb80947cff8c1175a02200606ccf8db60f56e77"
    "03f6d5b81f5f5141f5b029a7b5a35700907f368b7e0f024121038daab4c77b9a428efb"
    "23aa2ccadc5c5332f299f5e51d1f1600524c0313ab9ec2feffffff04fe66c200000000"
    "001976a914a8c27c62fafec0a07d28b3b905912e9f385a7f1a88ac2a3b560800000000"
    "1976a914c20992e92764ef7e33e2cf6ed538d34b18a1fff888ac00a3e1110000000019"
    "76a9147137cd9dc7aad0d1cbc8e0ec12aae753d1acfaf488ac5d2b0f00000000001976"
    "a914c10084f449e968b0d71ee23a308954c68d8c97e488ac28620700"
]

def test_tx_serialiazation():
    for test in tests:
        test = bytes.fromhex(test)
        deser = tx_lib.Deserializer(test)
        tx = deser.read_tx()
        assert tx.serialize() == test


def test_nito_v4_private_only_deserialization():
    raw = bytes.fromhex(
        "02000000"  # version
        "00"        # extended marker
        "02"        # Nito private effects flag
        "00"        # transparent vin count
        "00"        # transparent vout count
        "01000000"  # private effects version
        "03"        # private effects flags
        + ("00" * 32)  # anchor
        + ("00" * 8)   # value_balance
        + "00"        # action count
        + "00000000"  # locktime
    )
    deser = tx_lib.DeserializerNitoV4(raw)
    with pytest.raises(tx_lib.SkipTxDeserialize, match='action count'):
        deser.read_tx()


def test_nito_v4_private_action_compact_fields():
    enc_ciphertext = bytes([0x8a]) + bytes(579)
    raw = b''.join((
        bytes.fromhex("02000000"),  # version
        b"\x00",                    # extended marker
        b"\x02",                    # private effects flag
        b"\x00",                    # transparent vin count
        b"\x00",                    # transparent vout count
        bytes.fromhex("01000000"),  # private effects version
        b"\x03",                    # private effects flags
        bytes([0x99]) * 32,         # anchor
        bytes(8),                   # value_balance
        b"\x01",                    # action count
        b"\x01",                    # action version
        bytes([0x11]) * 32,         # cv
        bytes([0x22]) * 32,         # nullifier
        bytes([0x33]) * 32,         # rk
        bytes([0x44]) * 32,         # cmx
        pack_varbytes(bytes([0x55]) * 32),
        pack_varbytes(enc_ciphertext),
        pack_varbytes(bytes([0x66]) * 80),
        bytes(4),                   # locktime
    ))

    tx = tx_lib.DeserializerNitoV4(raw).read_tx()

    effects = tx.private_effects
    assert effects is not None
    assert effects.version == 1
    assert effects.flags == 3
    assert effects.anchor == bytes([0x99]) * 32
    assert len(effects.actions) == 1
    action = effects.actions[0]
    assert action.version == 1
    assert action.nullifier == bytes([0x22]) * 32
    assert action.cmx == bytes([0x44]) * 32
    assert action.ephemeral_key == bytes([0x55]) * 32
    assert action.compact_ciphertext == enc_ciphertext[:52]
    assert action.view_tag == (enc_ciphertext[0] ^ 0x02)


def test_nito_v4_rejects_private_auth_without_private_effects():
    raw = bytes.fromhex(
        "02000000"  # version
        "00"        # extended marker
        "04"        # private auth without private effects
        "00"        # transparent vin count
        "00"        # transparent vout count
        "00000000"  # locktime
    )
    deser = tx_lib.DeserializerNitoV4(raw)

    with pytest.raises(tx_lib.SkipTxDeserialize):
        deser.read_tx()
