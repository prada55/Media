// test/features/transactions/record_controller_test.dart

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';
import 'package:yako/features/transactions/domain/entities/recording_state.dart';
import 'package:yako/features/transactions/domain/entities/transaction.dart';
import 'package:yako/features/transactions/domain/services/audio_storage_service.dart';
import 'package:yako/features/transactions/domain/services/microphone_permission.dart';
import 'package:yako/features/transactions/presentation/providers/record_controller.dart';
import 'package:yako/features/transactions/presentation/providers/transaction_providers.dart';

import '../../helpers/fake_transaction_repository.dart';
import '../../helpers/mocks.dart';

class _MockAudioStorage extends Mock implements AudioStorageService;

void main() {
  late MockVoiceService voice;
  late MockMicrophonePermission mic;
  late _MockAudioStorage audio;
  late FakeTransactionRepository repo;
  late ProviderContainer container;

  setUp(() {
    voice = MockVoiceService();
    mic = MockMicrophonePermission();
    audio = _MockAudioStorage();
    repo = FakeTransactionRepository();
    when(voice.startRecording).thenAnswer((_) async => const Success(null));
    when(voice.stopRecording).thenAnswer(
      (_) async => const Success(
        RecordedAudio(tempPath: '/tmp/rec.m4a', duration: Duration(seconds: 3)),
      ),
    );
    when(() => voice.transcribeAudio(any())).thenAnswer(
      (_) async => const FailureResult(
        FeatureNotAvailableFailure(technicalMessage: 'no model'),
      ),
    );
    when(() => voice.deleteAudio(any())).thenAnswer((_) async {});
    when(() => audio.storeEncrypted(any()))
        .thenAnswer((_) async => const Success('audio/x.enc'));
    container = ProviderContainer(
      overrides: [
        voiceServiceProvider.overrideWithValue(voice),
        microphonePermissionProvider.overrideWithValue(mic),
        audioStorageServiceProvider.overrideWithValue(audio),
        transactionRepositoryProvider.overrideWithValue(repo),
      ],
    );
  });

  tearDown(() => container.dispose());

  RecordController controller() {
    container.listen(recordControllerProvider, (_, _) {});
    return container.read(recordControllerProvider.notifier);
  }

  RecordUiState state() => container.read(recordControllerProvider);

  test('permission asked only when not yet granted; refusal shown', () async {
    when(mic.status).thenAnswer((_) async => MicPermission.denied);
    when(mic.request).thenAnswer((_) async => MicPermission.permanentlyDenied);
    await controller().startRecording();
    expect(state().permission, MicPermission.permanentlyDenied);
    expect(state().phase, RecordPhase.idle);
    verifyNever(voice.startRecording);
  });

  test('already granted → no prompt', () async {
    when(mic.status).thenAnswer((_) async => MicPermission.granted);
    await controller().startRecording();
    verifyNever(mic.request);
    expect(state().phase, RecordPhase.recording);
  });

  test('STT unavailable → manual form with audio kept, then saved '
      'encrypted', () async {
    when(mic.status).thenAnswer((_) async => MicPermission.granted);
    final c = controller();
    await c.startRecording();
    await c.stopRecording();

    expect(state().phase, RecordPhase.review);
    expect(state().hasAudio, isTrue);
    expect(state().notice, isNotNull);

    final saved = await c.save(
      type: TransactionType.sale,
      amount: 25000,
      category: TransactionCategory.saleGoods,
      transcript: ' riz ',
    );
    expect(saved.isSuccess, isTrue);
    verify(() => audio.storeEncrypted('/tmp/rec.m4a')).called(1);
    expect(repo.items.single.audioPath, 'audio/x.enc');
    expect(repo.items.single.transcriptFr, 'riz');
    expect(state().hasAudio, isFalse);
  });

  test('disposing with an unsaved recording wipes the temp file', () async {
    when(mic.status).thenAnswer((_) async => MicPermission.granted);
    final c = controller();
    await c.startRecording();
    await c.stopRecording();
    container.dispose();
    verify(() => voice.deleteAudio('/tmp/rec.m4a')).called(1);
    container = ProviderContainer();
  });

  test('manual entry without voice', () async {
    final c = controller()..typeManually();
    expect(state().phase, RecordPhase.review);
    await c.save(
      type: TransactionType.expense,
      amount: 2000,
      category: TransactionCategory.expenseTransport,
      transcript: '',
    );
    verifyNever(() => audio.storeEncrypted(any()));
    expect(repo.items.single.audioPath, isNull);
  });
}
