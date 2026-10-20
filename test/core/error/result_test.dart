// test/core/error/result_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:yako/core/error/failure.dart';
import 'package:yako/core/error/result.dart';

const _failure = ValidationFailure(
  technicalMessage: 'bad input',
  userMessageFr: 'Saisie invalide',
);

void main() {
  const Result<int> ok = Success(2);
  const Result<int> ko = FailureResult(_failure);

  test('isSuccess / isFailure', () {
    expect(ok.isSuccess, isTrue);
    expect(ok.isFailure, isFalse);
    expect(ko.isSuccess, isFalse);
    expect(ko.isFailure, isTrue);
  });

  test('getOrNull / getFailureOrNull', () {
    expect(ok.getOrNull(), 2);
    expect(ok.getFailureOrNull(), isNull);
    expect(ko.getOrNull(), isNull);
    expect(ko.getFailureOrNull(), same(_failure));
  });

  test('fold', () {
    expect(ok.fold((v) => 'v$v', (f) => 'f'), 'v2');
    expect(ko.fold((v) => 'v$v', (f) => f.userMessageFr), 'Saisie invalide');
  });

  test('map transforms success and keeps failure', () {
    expect(ok.map((v) => v * 10).getOrNull(), 20);
    final mapped = ko.map((v) => v * 10);
    expect(mapped, isA<FailureResult<int>>());
    expect(mapped.getFailureOrNull(), same(_failure));
  });

  test('flatMap chains', () {
    expect(ok.flatMap((v) => Success('$v')).getOrNull(), '2');
    expect(
      ok.flatMap<String>((_) => const FailureResult(_failure)).isFailure,
      isTrue,
    );
    expect(ko.flatMap((v) => Success('$v')).isFailure, isTrue);
  });

  test('factory constructors', () {
    expect(const Result<int>.success(1), isA<Success<int>>());
    expect(const Result<int>.failure(_failure), isA<FailureResult<int>>());
  });

  test('failure messages and defaults', () {
    const db = DatabaseFailure(technicalMessage: 'x');
    expect(db.userMessageFr, isNotEmpty);
    expect(db.toString(), 'Failure(x)');
    final error = StateError('boom');
    final enc = EncryptionFailure(
      technicalMessage: 'y',
      cause: error,
      stackTrace: StackTrace.current,
    );
    expect(enc.cause, same(error));
    expect(enc.stackTrace, isNotNull);
    expect(
      const UnknownFailure(technicalMessage: 'z').userMessageFr,
      isNotEmpty,
    );
  });
}
