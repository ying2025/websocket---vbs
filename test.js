void ConnectionI::handle_check(const CheckPtr& check)
{
	const xstr_t& cmd = check->command();
	const VDict& args = check->args();

	if (!_incoming)	// client side
	{
		if (xstr_equal_cstr(&cmd, "FORBIDDEN"))
		{
			xstr_t reason = args.getXstr("reason");
			throw XERROR_MSG(AuthenticationException, make_string(reason));
		}
		else if (xstr_equal_cstr(&cmd, "AUTHENTICATE"))
		{
			if (_ck_state != CK_INIT)
				throw XERROR_FMT(XError, "Unexpected command of Check message [%.*s]", XSTR_P(&cmd));

			xstr_t method = args.wantXstr("method");
			if (!xstr_equal_cstr(&method, "SRP6a"))
				throw XERROR_FMT(XError, "Unknown authenticate method [%.*s]", XSTR_P(&method));

			SecretBoxPtr sb = getSecretBox();
			if (!sb)
				throw XERROR_FMT(XError, "No SecretBox supplied");

			xstr_t identity, password;
			std::string host = !_host.empty() ? _host : _peer_ip;
			if (!sb->find(_service, _proto, host, _peer_port, identity, password))
			{
				throw XERROR_FMT(XError, "No matched secret for `%s@%s+%s+%d`",
					_service.c_str(), _proto.c_str(), host.c_str(), _peer_port);
			}

			Srp6aClientPtr srp6aClient = new Srp6aClient();
			_srp6a = srp6aClient;
			srp6aClient->set_identity(identity, password);

			CheckWriter cw("SRP6a1");
			cw.param("I", identity);
			send_kmsg(cw.take());
			_ck_state = CK_S2;
		}
		else if (xstr_equal_cstr(&cmd, "SRP6a2"))
		{
			if (_ck_state != CK_S2)
				throw XERROR_FMT(XError, "Unexpected command of Check message [%.*s]", XSTR_P(&cmd));

			xstr_t hash = args.getXstr("hash");
			xstr_t N = args.wantBlob("N");
			xstr_t g = args.wantBlob("g");
			xstr_t s = args.wantBlob("s");
			xstr_t B = args.wantBlob("B");

			Srp6aClientPtr srp6aClient = Srp6aClientPtr::cast(_srp6a);
			srp6aClient->set_hash(hash);
			srp6aClient->set_parameters(g, N, N.len * 8);
			srp6aClient->set_salt(s);
			srp6aClient->set_B(B);
			xstr_t A = srp6aClient->gen_A();
			xstr_t M1 = srp6aClient->compute_M1();

			CheckWriter cw("SRP6a3");
			cw.paramBlob("A", A);
			cw.paramBlob("M1", M1);
			send_kmsg(cw.take());
			_ck_state = CK_S4;
		}
		else if (xstr_equal_cstr(&cmd, "SRP6a4"))
		{
			if (_ck_state != CK_S4)
				throw XERROR_FMT(XError, "Unexpected command of Check message [%.*s]", XSTR_P(&cmd));

			xstr_t M2 = args.wantBlob("M2");
			Srp6aClientPtr srp6aClient = Srp6aClientPtr::cast(_srp6a);
			xstr_t M2_mine = srp6aClient->compute_M2();
			if (!xstr_equal(&M2, &M2_mine))
				throw XERROR_FMT(XError, "srp6a M2 not equal");

			xstr_t cipher = args.getXstr("CIPHER");
			MyCipher::CipherSuite suite = (cipher.len == 0) ? MyCipher::CLEARTEXT
					: MyCipher::get_cipher_id_from_name(make_string(cipher));
			if (suite < 0)
				throw XERROR_FMT(XError, "Unknown CIPHER \"%.*s\"", XSTR_P(&cipher));

			if (suite > 0)
			{
				xstr_t K = srp6aClient->compute_K();
				_cipher = new MyCipher(suite, K.data, K.len, false);
				int mode = args.getInt("MODE", 0);
				if (mode == 0)
				{
					_cipher->setMode0(true);
				}
			}

			_ck_state = CK_FINISH;
			_srp6a.reset();
		}
	}

	// server side
	try
	{
		if (xstr_equal_cstr(&cmd, "SRP6a1"))
		{
			if (_ck_state != CK_S1)
				throw XERROR_FMT(XError, "Unexpected command of Check message [%.*s]", XSTR_P(&cmd));

			xstr_t identity = args.wantXstr("I");
			xstr_t method, paramId, hashId, salt, verifier;
			if (!_shadowBox->getVerifier(identity, method, paramId, hashId, salt, verifier))
				throw XERROR_FMT(XError, "No such identity [%.*s]", XSTR_P(&identity));

			Srp6aServerPtr srp6aServer = _shadowBox->newSrp6aServer(paramId, hashId);
			ENFORCE(srp6aServer);
			_srp6a = srp6aServer;

			srp6aServer->set_v(verifier);
			xstr_t B = srp6aServer->gen_B();

			CheckWriter cw("SRP6a2");
			cw.param("hash", srp6aServer->hash_name());
			cw.paramBlob("s", salt);
			cw.paramBlob("B", B);
			cw.paramBlob("g", srp6aServer->get_g());
			cw.paramBlob("N", srp6aServer->get_N());
			send_kmsg(cw.take());
			_ck_state = CK_S3;
		}
		else if (xstr_equal_cstr(&cmd, "SRP6a3"))
		{
			if (_ck_state != CK_S3)
				throw XERROR_FMT(XError, "Unexpected command of Check message [%.*s]", XSTR_P(&cmd));

			xstr_t A = args.wantBlob("A");
			xstr_t M1 = args.wantBlob("M1");

			Srp6aServerPtr srp6aServer = Srp6aServerPtr::cast(_srp6a);
			srp6aServer->set_A(A);
			xstr_t M1_mine = srp6aServer->compute_M1();
			if (!xstr_equal(&M1, &M1_mine))
				throw XERROR_FMT(XError, "srp6a M1 not equal");

			if (xic_cipher > 0)
			{
				xstr_t K = srp6aServer->compute_K();
				_cipher = new MyCipher(xic_cipher, K.data, K.len, true);
				if (xic_cipher_mode == 0)
					_cipher->setMode0(true);
			}

			xstr_t M2 = srp6aServer->compute_M2();
			CheckWriter cw("SRP6a4");
			cw.paramBlob("M2", M2);
			cw.param("CIPHER", MyCipher::get_cipher_name_from_id(xic_cipher));
			cw.param("MODE", xic_cipher_mode);
			send_kmsg(cw.take());
			send_kmsg(HelloMessage::create());

			_ck_state = CK_FINISH;
			_state = ST_ACTIVE;
			_shadowBox.reset();
			_srp6a.reset();
			checkFinished();
		}
	}
	catch (XError& ex)
	{
		if (xic_dlog_warning)
			dlog("XIC.WARNING", "peer=%s+%d #=client authentication failed, %s", _peer_ip, _peer_port, ex.message().c_str());

		CheckWriter cw("FORBIDDEN");
		cw.param("reason", ex.message());
		send_kmsg(cw.take());
		throw;
	}
}
