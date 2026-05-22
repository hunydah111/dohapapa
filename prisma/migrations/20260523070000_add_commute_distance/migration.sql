-- 운전 거리(미터) 캐시 컬럼 추가. 카카오 길찾기 응답에 함께 오는 distance 를
-- 추가 호출 없이 저장해 결과 카드에 "운전 N km"로 표시한다.
-- 추가형·널 허용이라 기존 행에 영향 없음(테이블 재작성 없음).
ALTER TABLE "CommuteCache" ADD COLUMN "distanceMeters" INTEGER;
