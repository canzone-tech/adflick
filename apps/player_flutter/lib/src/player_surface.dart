import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'device_client.dart';
import 'player_models.dart';

/// An Android video/image ad surface. UI telemetry is self-reported and is
/// explicitly NOT independent proof-of-display or payment eligibility.
class PlayerSurface extends StatefulWidget {
  final AdEntry? entry;
  final DeviceCredentials credentials;
  final DeviceClient client;
  final bool lBand;
  final void Function(AdEntry) onFinished;
  const PlayerSurface({super.key, required this.entry, required this.credentials,
    required this.client, required this.lBand, required this.onFinished});

  @override
  State<PlayerSurface> createState() => _PlayerSurfaceState();
}

class _PlayerSurfaceState extends State<PlayerSurface> {
  VideoPlayerController? _video;
  Timer? _imageTimer;
  DateTime? _started;
  bool _complete = false;
  String? _error;
  bool _ready = false;
  final _random = Random.secure();

  String _newId() => '${DateTime.now().toUtc().microsecondsSinceEpoch}-${_random.nextInt(1 << 30).toRadixString(16)}';

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    final entry = widget.entry;
    if (entry == null) return;
    if (!entry.authorizationExpiresAt.isAfter(DateTime.now().toUtc())) {
      setState(() => _error = 'Ad authorization expired.');
      return;
    }
    if (entry.mimeType.startsWith('video/')) {
      final player = VideoPlayerController.networkUrl(entry.mediaUrl);
      _video = player;
      player.addListener(_videoChanged);
      try {
        await player.initialize();
        if (!mounted || _video != player) return;
        setState(() => _ready = true);
        await player.play();
      } catch (_) {
        if (mounted) _finish('PLAY_ERROR', 'Media could not be decoded.');
      }
    } else {
      // Image telemetry starts only after Flutter has delivered an image frame.
      setState(() => _ready = true);
    }
  }

  void _videoChanged() {
    final player = _video;
    if (!mounted || _complete || player == null) return;
    final v = player.value;
    if (v.hasError) {
      _finish('PLAY_ERROR', 'Video decoder error.');
      return;
    }
    if (v.isPlaying && _started == null) _start();
    if (_started != null && v.isInitialized &&
        !v.isPlaying && v.position >= v.duration - const Duration(milliseconds: 200) &&
        v.duration > Duration.zero) {
      _finish('PLAY_COMPLETED', null);
    }
  }

  void _start() {
    final entry = widget.entry;
    if (entry == null || _started != null || _complete) return;
    _started = DateTime.now().toUtc();
    // Start events are informational, not financial evidence.
    unawaited(widget.client.reportEvent(widget.credentials, entry, 'PLAY_STARTED',
      eventId: _newId(), startedAt: _started).catchError((Object _) => false));
    if (entry.mimeType.startsWith('image/') && entry.expectedDurationMs != null) {
      _imageTimer = Timer(Duration(milliseconds: entry.expectedDurationMs!), () {
        if (mounted) _finish('PLAY_COMPLETED', null);
      });
    }
  }

  void _finish(String requestedType, String? error) {
    final entry = widget.entry;
    if (_complete || entry == null) return;
    _complete = true;
    _imageTimer?.cancel();
    final now = DateTime.now().toUtc();
    final duration = _started == null ? null : now.difference(_started!).inMilliseconds;
    final expected = entry.expectedDurationMs;
    // Client only proposes completion for a measurable, sufficiently long run;
    // the NestJS API independently validates duration/grant and may reject it.
    final completion = requestedType == 'PLAY_COMPLETED' &&
        duration != null && duration > 0 && expected != null &&
        duration >= (expected * 0.9).floor();
    final type = requestedType == 'PLAY_COMPLETED' && !completion ? 'PLAY_INTERRUPTED' : requestedType;
    if (mounted) setState(() => _error = error);
    unawaited(widget.client.reportEvent(widget.credentials, entry, type,
      eventId: _newId(), startedAt: _started,
      completedAt: now, durationMs: duration).catchError((Object _) => false)
      .whenComplete(() {
        if (mounted) widget.onFinished(entry);
      }));
  }

  @override
  Widget build(BuildContext context) {
    final entry = widget.entry;
    if (entry == null) return const Center(child: Text(
      'No authorized ad media available. Screen will remain idle.',
      textAlign: TextAlign.center, style: TextStyle(color: Colors.white70)));
    final content = Container(
      color: Colors.black,
      alignment: Alignment.center,
      child: _error != null
        ? Text(_error!, style: const TextStyle(color: Colors.orangeAccent))
        : !_ready ? const CircularProgressIndicator()
        : entry.mimeType.startsWith('image/')
          ? Image.network(entry.mediaUrl.toString(),
              fit: BoxFit.contain,
              frameBuilder: (_, child, frame, __) {
                if (frame != null && _started == null && !_complete) {
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted && _started == null) _start();
                  });
                }
                return child;
              },
              errorBuilder: (_, __, ___) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted && !_complete) _finish('PLAY_ERROR', 'Image download failed.');
                });
                return const Text('Image unavailable');
              })
          : _video != null && _video!.value.isInitialized
            ? AspectRatio(aspectRatio: _video!.value.aspectRatio,
                child: VideoPlayer(_video!))
            : const Text('Video unavailable'),
    );
    if (!widget.lBand) return SizedBox.expand(child: content);
    // L-band foundation from the provided SmartTV architecture: main 75%x75%,
    // right ad 25%x75%, bottom ad 100%x25%. Primary live video integration
    // requires an authorized source and is deliberately NOT simulated.
    return LayoutBuilder(builder: (context, constraints) {
      final w = constraints.maxWidth, h = constraints.maxHeight;
      return Stack(children: [
        Positioned(left: 0, top: 0, width: w * .75, height: h * .75,
          child: const ColoredBox(color: Color(0xff121728),
            child: Center(child: Padding(padding: EdgeInsets.all(20),
              child: Text('PRIMARY VIDEO INPUT NOT CONNECTED\nNo third-party video is replaced.',
                textAlign: TextAlign.center, style: TextStyle(color: Colors.white70)))))),
        Positioned(left: w * .75, top: 0, width: w * .25, height: h * .75,
          child: content),
        Positioned(left: 0, top: h * .75, width: w, height: h * .25,
          child: ColoredBox(color: const Color(0xff421752),
            child: Center(child: Text('AD • ${entry.title}',
              textAlign: TextAlign.center, maxLines: 2,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))))),
      ]);
    });
  }

  @override
  void dispose() {
    _imageTimer?.cancel();
    final player = _video;
    if (player != null) {
      player.removeListener(_videoChanged);
      unawaited(player.dispose());
    }
    super.dispose();
  }
}
