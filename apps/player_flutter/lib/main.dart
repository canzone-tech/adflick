import 'dart:async';
import 'package:flutter/material.dart';
import 'src/device_client.dart';
import 'src/player_models.dart';
import 'src/player_surface.dart';

void main() => runApp(const AdflickApp());

class AdflickApp extends StatelessWidget {
  const AdflickApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'ADFLICK Android Advertising Player',
    debugShowCheckedModeBanner: false,
    theme: ThemeData.dark(useMaterial3: true).copyWith(
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xffb751ff),
        brightness: Brightness.dark)),
    home: const PlayerHome(),
  );
}

class PlayerHome extends StatefulWidget {
  const PlayerHome({super.key});
  @override
  State<PlayerHome> createState() => _PlayerHomeState();
}

class _PlayerHomeState extends State<PlayerHome> {
  final _client = DeviceClient();
  final _server = TextEditingController();
  final _pairing = TextEditingController();
  DeviceCredentials? _credentials;
  AdManifest? _manifest;
  AdEntry? _active;
  Timer? _heartbeat;
  Timer? _refresh;
  bool _busy = false;
  bool _lBand = false;
  String? _error;
  String _status = 'Not paired';

  String get _platform => MediaQuery.sizeOf(context).shortestSide >= 600
      ? 'Android TV' : 'Android Mobile';

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    try {
      final credentials = await _client.restore();
      if (!mounted) return;
      setState(() { _credentials = credentials; _status = credentials == null ? 'Enter a 12-character pairing code' : 'Paired; connecting…'; });
      if (credentials != null) _start();
    } catch (_) {
      if (mounted) setState(() => _error = 'Secure storage unavailable; device pairing required.');
    }
  }

  Future<void> _pair() async {
    if (_busy) return;
    setState(() { _busy = true; _error = null; });
    try {
      final credentials = await _client.pair(_server.text, _pairing.text, _platform);
      if (!mounted) return;
      setState(() { _credentials = credentials; _status = 'Paired; loading authorized ads…'; });
      _pairing.clear();
      _start();
    } catch (error) {
      if (mounted) setState(() => _error = error is FormatException ? error.message : 'Pairing failed. Check server and code.');
    } finally { if (mounted) setState(() => _busy = false); }
  }

  void _start() {
    _heartbeat?.cancel();
    _refresh?.cancel();
    void beat(Timer _) => _sendHeartbeat();
    _sendHeartbeat();
    _loadManifest();
    _heartbeat = Timer.periodic(const Duration(seconds: 60), beat);
    _refresh = Timer.periodic(const Duration(seconds: 45), (_) => _loadManifest());
  }

  Future<void> _sendHeartbeat() async {
    final c = _credentials;
    if (c == null) return;
    try { await _client.heartbeat(c, _platform, playerError: _error); }
    catch (_) { if (mounted) setState(() => _status = 'Heartbeat unavailable — network check required'); }
  }

  Future<void> _loadManifest() async {
    final c = _credentials;
    if (c == null) return;
    try {
      final manifest = await _client.manifest(c);
      if (!mounted || _credentials != c) return;
      setState(() {
        _manifest = manifest; _error = null;
        _status = manifest.entries.isEmpty
            ? 'No authorized READY ads assigned to this device' : 'Authorized ad manifest loaded';
        if (_active == null || _active!.authorizationExpiresAt.isBefore(DateTime.now().toUtc())) {
          _active = manifest.entries.isEmpty ? null : manifest.entries.first;
        }
      });
    } catch (_) {
      if (mounted) setState(() {
        _error = 'Cannot load a valid authorized manifest. Playback is paused.';
        _active = null; _manifest = null;
      });
    }
  }

  void _next(AdEntry finished) {
    if (!mounted || _active != finished) return;
    final manifest = _manifest;
    if (manifest == null || !manifest.expiresAt.isAfter(DateTime.now().toUtc())) {
      setState(() => _active = null);
      _loadManifest();
      return;
    }
    final current = manifest.entries.indexOf(finished);
    final following = current + 1;
    // Do not replay a consumed one-time authorization from this manifest.
    if (current < 0 || following >= manifest.entries.length) {
      setState(() => _active = null);
      _loadManifest();
    } else {
      setState(() => _active = manifest.entries[following]);
    }
  }

  Future<void> _unpair() async {
    _heartbeat?.cancel(); _refresh?.cancel();
    await _client.clear();
    if (mounted) setState(() {
      _credentials = null; _manifest = null; _active = null;
      _error = null; _status = 'Unpaired';
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = _credentials;
    final size = MediaQuery.sizeOf(context);
    final tv = size.shortestSide >= 600;
    return Scaffold(
      backgroundColor: const Color(0xff05060b),
      body: SafeArea(child: c == null
        ? Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 550),
            child: ListView(shrinkWrap: true, padding: const EdgeInsets.all(24), children: [
              const Icon(Icons.tv, size: 62, color: Color(0xffd778fa)),
              const SizedBox(height: 20),
              Text('ADFLICK • Android ${tv ? "TV" : "Mobile"} Ads', style: Theme.of(context).textTheme.headlineSmall, textAlign: TextAlign.center),
              const SizedBox(height: 10),
              const Text('Pair this advertising screen from the authorized ADFLICK Fleet dashboard.',
                textAlign: TextAlign.center),
              const SizedBox(height: 24),
              TextField(controller: _server, decoration: const InputDecoration(labelText: 'HTTPS API server',
                hintText: 'https://your-approved-host.example'), keyboardType: TextInputType.url),
              const SizedBox(height: 14),
              TextField(controller: _pairing, decoration: const InputDecoration(labelText: 'One-time pairing code'),
                textCapitalization: TextCapitalization.characters, maxLength: 16),
              const SizedBox(height: 14),
              FilledButton(onPressed: _busy ? null : _pair, child: Text(_busy ? 'Pairing…' : 'Pair device')),
              if (_error != null) Text(_error!, style: const TextStyle(color: Colors.orangeAccent)),
              Text(_status, textAlign: TextAlign.center),
            ])))
        : Column(children: [
          Expanded(child: PlayerSurface(
            key: ValueKey(_active?.authorizationId),
            entry: _active, credentials: c, client: _client,
            lBand: _lBand, onFinished: _next,
          )),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            color: const Color(0xff141421),
            child: Row(children: [
              Expanded(child: Text(_error ?? _status, maxLines: 2, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12))),
              TextButton(onPressed: () => setState(() => _lBand = !_lBand),
                child: Text(_lBand ? 'Full-screen ads' : 'L-band preview')),
              TextButton(onPressed: _loadManifest, child: const Text('Sync')),
              TextButton(onPressed: _unpair, child: const Text('Unpair')),
            ]),
          ),
        ])),
    );
  }

  @override
  void dispose() {
    _heartbeat?.cancel(); _refresh?.cancel();
    _client.close(); _server.dispose(); _pairing.dispose();
    super.dispose();
  }
}
