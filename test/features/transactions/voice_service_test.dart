// test/features/transactions/voice_service_test.dart

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:record/record.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/transactions/data/services/stt_engine.dart';
import 'package:yako/features/transactions/data/services/voice_service_impl.dart';
import 'package:yako/features/transactions/domain/entities/recording_state.dart';

import '../../helpers/mocks.dart';

class _MockRecorder extends Mock implements AudioRecorder;

class _MockStt extends Mock implements SttEngine;

void main() {
  late _MockRecorder recorder;
  late _MockStt stt;
  late MockAppDirectories directories;
  late Directory tmp;
  late VoiceServiceImpl service;
  late DateTime now;

  setUpAll(() => registerFallbackValue(const RecordConfig()));

  setUp(() async {
    recorder = _MockRecorder();
    stt = _MockStt();
    directories = MockAppDirectories();
    tmp = await Directory.systemTemp.createTemp('yako_voice_');
    now = DateTime(2026);
    when(directories.temporary).thenAnswer((_) async => tmp);
    service = VoiceServiceImpl(
      recorder: recorder,
      stt: stt,
      directories: directories,
      now: () => now,
    );
  });

  tearDown(() => tmp.delete(recursive: true));

  test('records AAC 16 kHz mono 32 kbps into the private temp dir', () async {
    when(() => recorder.start(any(), path: any(named: 'path')))
        .thenAnswer((_) async {});
    final states = <RecordingState>[];
    final sub = service.watchRecordingState().listen(states.add);

    expect((await service.startRecording()).isSuccess, isTrue);

    final captured = verify(
      () => recorder.start(captureAny(), path: captureAny(named: 'path')),
    ).captured;
    final config = captured[0] as RecordConfig;
    expect(config.encoder, AudioEncoder.aacLc);
    expect(config.sampleRate, 16000);
    expect(config.numChannels, 1);
    expect(config.bitRate, 32000);
    expect(captured[1] as String, startsWith(tmp.path));

    await Future<void>.delayed(Duration.zero);
    expect(states.last, RecordingState.recording);
    await sub.cancel();
  });

  test('stop returns the file and the duration', () async {
    when(() => recorder.start(any(), path: any(named: 'path')))
        .thenAnswer((_) async {});
    when(recorder.stop).thenAnswer((_) async => '${tmp.path}/a.m4a');
    await service.startRecording();
    now = now.add(const Duration(seconds: 4));
    final audio = (await service.stopRecording()).getOrNull()!;
    expect(audio.tempPath, '${tmp.path}/a.m4a');
    expect(audio.duration, const Duration(seconds: 4));
  });

  test('stop without recording → failure', () async {
    when(recorder.stop).thenAnswer((_) async => null);
    expect((await service.stopRecording()).isFailure, isTrue);
  });

  test('recorder error → failure, back to idle', () async {
    when(() => recorder.start(any(), path: any(named: 'path')))
        .thenThrow(Exception('mic busy'));
    expect((await service.startRecording()).isFailure, isTrue);
    expect(await service.watchRecordingState().first, RecordingState.idle);
  });

  test('transcription delegates to the STT engine', () async {
    when(() => stt.transcribe(any()))
        .thenAnswer((_) async => const Success('vendu riz 25000'));
    expect(
      (await service.transcribeAudio('x.m4a')).getOrNull(),
      'vendu riz 25000',
    );
  });

  test('stub engine → FeatureNotAvailableFailure, never available', () async {
    TestWidgetsFlutterBinding.ensureInitialized();
    final stub = StubSttEngine();
    expect(await stub.isAvailable(), isFalse);
    expect(await stub.isModelBundled(), isFalse);
    final result = await stub.transcribe('x.m4a');
    expect(result.getFailureOrNull(), isA<FeatureNotAvailableFailure>());
  });

  test('deleteAudio wipes the temp file', () async {
    final file = File('${tmp.path}/b.m4a')..writeAsBytesSync([1, 2, 3]);
    await service.deleteAudio(file.path);
    expect(file.existsSync(), isFalse);
  });
}
